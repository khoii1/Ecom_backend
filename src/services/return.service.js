import { ReturnModel } from "../models/return.model.js";
import { OrderModel } from "../models/order.model.js";
import { OrderItemModel } from "../models/order_item.model.js";
import { ProductModel } from "../models/product.model.js";
import { ROLES } from "../constants/roles.js";
import { logger } from "../utils/logger.js";

// Helper function để format return cho frontend
const formatReturnForFrontend = (returnDoc) => {
  if (!returnDoc) return returnDoc;

  const formatted = {
    ...returnDoc,
    id: returnDoc._id.toString(),
    created_at: returnDoc.createdAt || returnDoc.created_at,
    updated_at: returnDoc.updatedAt || returnDoc.updated_at,
  };

  // Xử lý order_id: giữ nguyên object nếu đã populate, convert sang string nếu chưa
  if (
    returnDoc.order_id &&
    typeof returnDoc.order_id === "object" &&
    returnDoc.order_id._id
  ) {
    // Đã populate - giữ nguyên object để frontend có thể truy cập code, status, etc.
    formatted.order_id = returnDoc.order_id;
  } else if (returnDoc.order_id) {
    // Chưa populate - convert sang string (chỉ khi không null)
    formatted.order_id = returnDoc.order_id.toString();
  } else {
    // Null hoặc undefined
    formatted.order_id = null;
  }

  // Xử lý user_id và store_id tương tự
  if (
    returnDoc.user_id &&
    typeof returnDoc.user_id === "object" &&
    returnDoc.user_id._id
  ) {
    formatted.user_id = returnDoc.user_id;
  } else if (returnDoc.user_id) {
    formatted.user_id = returnDoc.user_id.toString();
  } else {
    formatted.user_id = null;
  }

  if (
    returnDoc.store_id &&
    typeof returnDoc.store_id === "object" &&
    returnDoc.store_id._id
  ) {
    formatted.store_id = returnDoc.store_id;
  } else if (returnDoc.store_id) {
    formatted.store_id = returnDoc.store_id.toString();
  } else {
    formatted.store_id = null;
  }

  return formatted;
};

const formatReturnsForFrontend = (returns) => {
  if (!Array.isArray(returns)) return returns;
  return returns.map(formatReturnForFrontend);
};

export const ReturnService = {
  /**
   * Tạo return request - Customer
   */
  async create(currentUser, payload) {
    const { order_id, return_type, reason, description, items, images } =
      payload;

    logger.info("RETURN", "Creating return request", {
      userId: currentUser.id,
      payload: payload,
      order_id: order_id,
      hasOrderId: !!order_id,
    });

    // Validate order_id
    if (!order_id) {
      throw new Error("order_id là bắt buộc");
    }

    // 1. Kiểm tra order tồn tại và thuộc về user
    const order = await OrderModel.findById(order_id)
      .populate("order_items")
      .lean();

    if (!order) {
      throw new Error("Đơn hàng không tồn tại");
    }

    if (order.buyer_id.toString() !== currentUser.id.toString()) {
      throw new Error("Bạn không có quyền trả hàng cho đơn hàng này");
    }

    // 2. Kiểm tra điều kiện trả hàng
    if (order.status !== "delivered") {
      throw new Error(
        `Chỉ có thể trả hàng khi đơn hàng đã được giao. Trạng thái hiện tại: ${order.status}`
      );
    }

    if (!order.delivery_confirmed_by_customer) {
      throw new Error("Bạn cần xác nhận đã nhận hàng trước khi trả hàng");
    }

    // 3. Kiểm tra thời hạn trả hàng (7 ngày)
    const deliveryDate = order.delivery_confirmed_at || order.updatedAt;
    const daysSinceDelivery = Math.floor(
      (new Date() - new Date(deliveryDate)) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceDelivery > 7) {
      throw new Error(
        `Đã quá thời hạn trả hàng (7 ngày). Bạn đã nhận hàng ${daysSinceDelivery} ngày trước`
      );
    }

    // 4. Kiểm tra xem đã có return request đang pending/approved chưa
    const existingReturn = await ReturnModel.findOne({
      order_id,
      status: { $in: ["pending", "approved", "processing"] },
    }).lean();

    if (existingReturn) {
      throw new Error(
        `Đã có yêu cầu trả hàng đang được xử lý cho đơn hàng này (Status: ${existingReturn.status})`
      );
    }

    // 5. Validate items
    if (!items || items.length === 0) {
      throw new Error("Phải có ít nhất một sản phẩm để trả hàng");
    }

    const orderItems = await OrderItemModel.find({ order_id }).lean();
    const orderItemMap = new Map(
      orderItems.map((item) => [item._id.toString(), item])
    );

    const returnItems = [];
    let totalRefundAmount = 0;

    for (const item of items) {
      const orderItem = orderItemMap.get(item.order_item_id);
      if (!orderItem) {
        throw new Error(
          `Order item ${item.order_item_id} không tồn tại trong đơn hàng`
        );
      }

      if (item.qty > orderItem.qty) {
        throw new Error(
          `Số lượng trả hàng (${item.qty}) không được vượt quá số lượng đã mua (${orderItem.qty})`
        );
      }

      returnItems.push({
        order_item_id: orderItem._id,
        product_id: orderItem.product_id,
        qty: item.qty,
        unit_price: orderItem.unit_price,
        reason: item.reason || null,
      });

      // Tính refund amount (tính theo tỷ lệ nếu trả một phần)
      const itemSubtotal = orderItem.unit_price * item.qty;
      totalRefundAmount += itemSubtotal;
    }

    // 6. Tính discount amount (nếu có) - tính theo tỷ lệ
    let discountAmount = 0;
    if (order.discount_amount > 0 && order.subtotal > 0) {
      const returnRatio = totalRefundAmount / order.subtotal;
      discountAmount = order.discount_amount * returnRatio;
    }

    // Nếu trả toàn bộ đơn hàng, có thể bao gồm shipping fee (tùy chính sách)
    const finalRefundAmount = totalRefundAmount - discountAmount;

    // 7. Tạo return request
    const returnRequest = await ReturnModel.create({
      order_id,
      user_id: currentUser.id,
      store_id: order.store_id,
      return_type: return_type || "refund",
      reason,
      description: description || null,
      items: returnItems,
      refund_amount: finalRefundAmount,
      refund_method:
        order.payment_method === "vnpay" ? "original" : "bank_transfer",
      images: images || [],
      status: "pending",
    });

    // 8. Tạo notification cho seller
    const { NotificationModel } = await import(
      "../models/notification.model.js"
    );
    const { StoreModel } = await import("../models/store.model.js");

    const store = await StoreModel.findById(order.store_id)
      .populate("owner_id")
      .lean();

    if (store?.owner_id) {
      await NotificationModel.create({
        user_id: store.owner_id._id,
        type: "return",
        title: "Yêu cầu trả hàng mới",
        message: `Khách hàng yêu cầu trả hàng cho đơn hàng ${order.code}. Lý do: ${reason}`,
        order_id: order_id.toString(),
        data: {
          return_id: returnRequest._id.toString(),
          order_code: order.code,
          order_id: order_id.toString(),
        },
      });
    }

    logger.info("RETURN", "Tạo return request thành công", {
      returnId: returnRequest._id.toString(),
      orderId,
      userId: currentUser.id,
    });

    return formatReturnForFrontend(returnRequest.toObject());
  },

  /**
   * Lấy danh sách returns của customer
   */
  async listMyReturns(userId) {
    const returns = await ReturnModel.find({ user_id: userId })
      .populate("order_id", "code status total")
      .populate("store_id", "name")
      .sort({ createdAt: -1 })
      .lean();

    return formatReturnsForFrontend(returns);
  },

  /**
   * Lấy danh sách returns của store (seller)
   */
  async listByStore(storeId) {
    const returns = await ReturnModel.find({ store_id: storeId })
      .populate("order_id", "code status total")
      .populate("user_id", "full_name email")
      .populate({
        path: "items.product_id",
        select: "title image_url status price",
      })
      .sort({ createdAt: -1 })
      .lean();

    return formatReturnsForFrontend(returns);
  },

  /**
   * Chi tiết return
   */
  async detail(returnId, currentUser) {
    const returnDoc = await ReturnModel.findById(returnId)
      .populate("order_id")
      .populate("user_id", "full_name email")
      .populate("store_id", "name owner_id")
      .populate({
        path: "items.product_id",
        select: "title image_url",
      })
      .lean();

    if (!returnDoc) {
      throw new Error("Yêu cầu trả hàng không tồn tại");
    }

    // Kiểm tra quyền truy cập
    // user_id đã được populate thành object, cần lấy _id từ object
    const userId = returnDoc.user_id?._id
      ? returnDoc.user_id._id.toString()
      : returnDoc.user_id?.toString();
    const isOwner = userId === currentUser.id.toString();

    // store_id cũng đã được populate
    const storeId = returnDoc.store_id?._id
      ? returnDoc.store_id._id.toString()
      : returnDoc.store_id?.toString();

    let isStoreOwner = false;
    if (currentUser.role === ROLES.SELLER) {
      const { StoreModel } = await import("../models/store.model.js");
      const store = await StoreModel.findOne({
        _id: storeId,
        owner_id: currentUser.id,
      }).lean();
      isStoreOwner = !!store;
    }
    const isAdmin = currentUser.role === ROLES.ADMIN;

    if (!isOwner && !isStoreOwner && !isAdmin) {
      throw new Error("Bạn không có quyền xem yêu cầu trả hàng này");
    }

    return formatReturnForFrontend(returnDoc);
  },

  /**
   * Approve return - Seller/Admin
   */
  async approve(returnId, currentUser, adminNote) {
    const returnDoc = await ReturnModel.findById(returnId).lean();

    if (!returnDoc) {
      throw new Error("Yêu cầu trả hàng không tồn tại");
    }

    // Kiểm tra quyền
    if (currentUser.role !== ROLES.ADMIN) {
      if (currentUser.role === ROLES.SELLER) {
        const { StoreModel } = await import("../models/store.model.js");
        const store = await StoreModel.findOne({
          _id: returnDoc.store_id,
          owner_id: currentUser.id,
        }).lean();

        if (!store) {
          throw new Error("Bạn không có quyền duyệt yêu cầu trả hàng này");
        }
      } else {
        throw new Error(
          "Chỉ Seller hoặc Admin mới có quyền duyệt yêu cầu trả hàng"
        );
      }
    }

    if (returnDoc.status !== "pending") {
      throw new Error(
        `Chỉ có thể duyệt yêu cầu trả hàng ở trạng thái 'pending'. Trạng thái hiện tại: ${returnDoc.status}`
      );
    }

    // Cập nhật status
    const updated = await ReturnModel.findByIdAndUpdate(
      returnId,
      {
        $set: {
          status: "approved",
          admin_note: adminNote || null,
          processed_at: new Date(),
        },
      },
      { new: true }
    ).lean();

    // Xử lý hoàn tiền: trừ tiền từ ví seller, cộng vào ví user
    try {
      const { WalletService } = await import("./wallet.service.js");
      const { StoreModel } = await import("../models/store.model.js");

      // Lấy thông tin store để biết seller ID
      const store = await StoreModel.findById(returnDoc.store_id).lean();
      if (!store || !store.owner_id) {
        throw new Error("Không tìm thấy thông tin cửa hàng");
      }

      const sellerId = store.owner_id.toString();
      const refundAmount = returnDoc.refund_amount;

      // Lấy thông tin order để có order code
      const order = await OrderModel.findById(returnDoc.order_id).lean();
      const orderCode = order?.code || "N/A";

      // Trừ tiền từ ví seller
      await WalletService.deduct(
        sellerId,
        refundAmount,
        returnId.toString(),
        "return",
        `Hoàn tiền cho đơn hàng ${orderCode}: ${refundAmount.toLocaleString(
          "vi-VN"
        )} VNĐ`
      );

      logger.info("RETURN", "Đã trừ tiền từ ví seller", {
        returnId: returnId.toString(),
        sellerId,
        amount: refundAmount,
      });

      // Cộng tiền vào ví user
      await WalletService.add(
        returnDoc.user_id.toString(),
        refundAmount,
        returnId.toString(),
        "return",
        `Hoàn tiền đơn hàng ${orderCode}: ${refundAmount.toLocaleString(
          "vi-VN"
        )} VNĐ`
      );

      logger.info("RETURN", "Đã cộng tiền vào ví user", {
        returnId: returnId.toString(),
        userId: returnDoc.user_id.toString(),
        amount: refundAmount,
      });
    } catch (walletError) {
      logger.error("RETURN", "Lỗi khi xử lý hoàn tiền", {
        returnId: returnId.toString(),
        error: walletError.message,
      });

      // Rollback: đổi status về pending
      await ReturnModel.findByIdAndUpdate(returnId, {
        $set: {
          status: "pending",
          admin_note: `Lỗi xử lý hoàn tiền: ${walletError.message}`,
          processed_at: null,
        },
      });

      throw new Error(`Không thể xử lý hoàn tiền: ${walletError.message}`);
    }

    // Tạo notification cho customer
    const { NotificationModel } = await import(
      "../models/notification.model.js"
    );
    await NotificationModel.create({
      user_id: returnDoc.user_id,
      type: "return",
      title: "Yêu cầu trả hàng đã được duyệt",
      message: `Yêu cầu trả hàng của bạn đã được duyệt. Số tiền ${returnDoc.refund_amount.toLocaleString(
        "vi-VN"
      )} VNĐ đã được hoàn vào ví của bạn.`,
      order_id: returnDoc.order_id.toString(),
      data: {
        return_id: returnId.toString(),
        order_id: returnDoc.order_id.toString(),
        refund_amount: returnDoc.refund_amount,
      },
    });

    logger.info("RETURN", "Duyệt return request thành công", {
      returnId,
      approvedBy: currentUser.id,
    });

    return formatReturnForFrontend(updated);
  },

  /**
   * Reject return - Seller/Admin
   */
  async reject(returnId, currentUser, adminNote) {
    const returnDoc = await ReturnModel.findById(returnId).lean();

    if (!returnDoc) {
      throw new Error("Yêu cầu trả hàng không tồn tại");
    }

    // Kiểm tra quyền (tương tự approve)
    if (currentUser.role !== ROLES.ADMIN) {
      if (currentUser.role === ROLES.SELLER) {
        const { StoreModel } = await import("../models/store.model.js");
        const store = await StoreModel.findOne({
          _id: returnDoc.store_id,
          owner_id: currentUser.id,
        }).lean();

        if (!store) {
          throw new Error("Bạn không có quyền từ chối yêu cầu trả hàng này");
        }
      } else {
        throw new Error(
          "Chỉ Seller hoặc Admin mới có quyền từ chối yêu cầu trả hàng"
        );
      }
    }

    if (returnDoc.status !== "pending") {
      throw new Error(
        `Chỉ có thể từ chối yêu cầu trả hàng ở trạng thái 'pending'. Trạng thái hiện tại: ${returnDoc.status}`
      );
    }

    if (!adminNote) {
      throw new Error("Vui lòng cung cấp lý do từ chối");
    }

    // Cập nhật status
    const updated = await ReturnModel.findByIdAndUpdate(
      returnId,
      {
        $set: {
          status: "rejected",
          admin_note: adminNote,
          processed_at: new Date(),
        },
      },
      { new: true }
    ).lean();

    // Tạo notification cho customer
    const { NotificationModel } = await import(
      "../models/notification.model.js"
    );
    await NotificationModel.create({
      user_id: returnDoc.user_id,
      type: "return",
      title: "Yêu cầu trả hàng bị từ chối",
      message: `Yêu cầu trả hàng của bạn đã bị từ chối. Lý do: ${adminNote}`,
      order_id: returnDoc.order_id.toString(),
      data: {
        return_id: returnId.toString(),
        order_id: returnDoc.order_id.toString(),
      },
    });

    logger.info("RETURN", "Từ chối return request", {
      returnId,
      rejectedBy: currentUser.id,
    });

    return formatReturnForFrontend(updated);
  },

  /**
   * Process return - Chuyển sang processing (seller đã nhận hàng về)
   */
  async process(returnId, currentUser) {
    const returnDoc = await ReturnModel.findById(returnId).lean();

    if (!returnDoc) {
      throw new Error("Yêu cầu trả hàng không tồn tại");
    }

    // Kiểm tra quyền (tương tự approve)
    if (currentUser.role !== ROLES.ADMIN) {
      if (currentUser.role === ROLES.SELLER) {
        const { StoreModel } = await import("../models/store.model.js");
        const store = await StoreModel.findOne({
          _id: returnDoc.store_id,
          owner_id: currentUser.id,
        }).lean();

        if (!store) {
          throw new Error("Bạn không có quyền xử lý yêu cầu trả hàng này");
        }
      } else {
        throw new Error(
          "Chỉ Seller hoặc Admin mới có quyền xử lý yêu cầu trả hàng"
        );
      }
    }

    if (returnDoc.status !== "approved") {
      throw new Error(
        `Chỉ có thể xử lý yêu cầu trả hàng ở trạng thái 'approved'. Trạng thái hiện tại: ${returnDoc.status}`
      );
    }

    // Cập nhật status
    const updated = await ReturnModel.findByIdAndUpdate(
      returnId,
      {
        $set: {
          status: "processing",
        },
      },
      { new: true }
    ).lean();

    logger.info("RETURN", "Chuyển return sang processing", {
      returnId,
      processedBy: currentUser.id,
    });

    return formatReturnForFrontend(updated);
  },

  /**
   * Complete return - Hoàn tất trả hàng (trả stock, hoàn tiền)
   */
  async complete(returnId, currentUser) {
    const returnDoc = await ReturnModel.findById(returnId).lean();

    if (!returnDoc) {
      throw new Error("Yêu cầu trả hàng không tồn tại");
    }

    // Kiểm tra quyền (tương tự approve)
    if (currentUser.role !== ROLES.ADMIN) {
      if (currentUser.role === ROLES.SELLER) {
        const { StoreModel } = await import("../models/store.model.js");
        const store = await StoreModel.findOne({
          _id: returnDoc.store_id,
          owner_id: currentUser.id,
        }).lean();

        if (!store) {
          throw new Error("Bạn không có quyền hoàn tất yêu cầu trả hàng này");
        }
      } else {
        throw new Error(
          "Chỉ Seller hoặc Admin mới có quyền hoàn tất yêu cầu trả hàng"
        );
      }
    }

    if (returnDoc.status !== "processing") {
      throw new Error(
        `Chỉ có thể hoàn tất yêu cầu trả hàng ở trạng thái 'processing'. Trạng thái hiện tại: ${returnDoc.status}`
      );
    }

    // 1. Trả lại stock cho các sản phẩm
    for (const item of returnDoc.items) {
      await ProductModel.findByIdAndUpdate(item.product_id, {
        $inc: {
          stock_quantity: +item.qty,
        },
      });
    }

    logger.info("RETURN", "Đã trả lại stock", {
      returnId,
      itemsCount: returnDoc.items.length,
    });

    // 2. Cập nhật return status
    const updateData = {
      status: "completed",
      completed_at: new Date(),
    };

    // Chỉ set refund_status nếu là refund
    if (returnDoc.return_type === "refund") {
      updateData.refund_status = "processing"; // Bắt đầu xử lý hoàn tiền
    }

    const updated = await ReturnModel.findByIdAndUpdate(
      returnId,
      { $set: updateData },
      { new: true }
    ).lean();

    // 3. Xử lý hoàn tiền vào ví (chỉ khi return_type = 'refund')
    if (returnDoc.return_type === "refund") {
      if (
        returnDoc.refund_method === "wallet" ||
        returnDoc.refund_method === null
      ) {
        // Mặc định hoàn tiền vào ví nếu không chỉ định phương thức khác
        try {
          const { WalletService } = await import("./wallet.service.js");
          const { StoreModel } = await import("../models/store.model.js");

          // Lấy store owner_id (seller) để trừ tiền từ ví seller
          const store = await StoreModel.findById(returnDoc.store_id).lean();
          if (!store || !store.owner_id) {
            throw new Error(
              "Không tìm thấy thông tin cửa hàng hoặc chủ cửa hàng"
            );
          }

          const sellerId = store.owner_id.toString();
          const refundAmount = returnDoc.refund_amount;

          // 1. Trừ tiền từ ví seller
          try {
            await WalletService.deduct(
              sellerId,
              refundAmount,
              returnId.toString(),
              "return",
              `Trừ tiền hoàn trả hàng: ${refundAmount.toLocaleString(
                "vi-VN"
              )} VNĐ`
            );
            logger.info("RETURN", "Đã trừ tiền từ ví seller", {
              returnId,
              sellerId,
              amount: refundAmount,
            });
          } catch (deductError) {
            // Nếu seller không đủ tiền, vẫn cố gắng hoàn tiền cho user (có thể seller nợ)
            logger.error(
              "RETURN",
              "Lỗi khi trừ tiền từ ví seller (có thể không đủ tiền)",
              {
                returnId,
                sellerId,
                error: deductError.message,
              }
            );
            // Vẫn tiếp tục hoàn tiền cho user
          }

          // 2. Cộng tiền vào ví user
          await WalletService.add(
            returnDoc.user_id.toString(),
            refundAmount,
            returnId.toString(),
            "return",
            `Hoàn tiền từ yêu cầu trả hàng: ${refundAmount.toLocaleString(
              "vi-VN"
            )} VNĐ`
          );

          // Cập nhật refund_status = completed
          await ReturnModel.findByIdAndUpdate(returnId, {
            $set: {
              refund_status: "completed",
              refund_method: "wallet", // Đảm bảo refund_method được set
            },
          });

          logger.info("RETURN", "Đã hoàn tiền vào ví user", {
            returnId,
            userId: returnDoc.user_id.toString(),
            amount: refundAmount,
          });
        } catch (walletError) {
          logger.error("RETURN", "Lỗi khi hoàn tiền vào ví", {
            returnId,
            error: walletError.message,
          });
          // Vẫn cập nhật return status nhưng refund_status = failed
          await ReturnModel.findByIdAndUpdate(returnId, {
            $set: {
              refund_status: "failed",
            },
          });
        }
      } else if (returnDoc.refund_method === "original") {
        // Hoàn về phương thức thanh toán gốc (VNPay) - sẽ xử lý sau
        // Hiện tại chỉ đánh dấu là processing
        await ReturnModel.findByIdAndUpdate(returnId, {
          $set: {
            refund_status: "processing",
          },
        });
        logger.info(
          "RETURN",
          "Hoàn tiền về phương thức gốc (cần xử lý thủ công)",
          {
            returnId,
          }
        );
      }
    } else if (returnDoc.return_type === "exchange") {
      // Đổi hàng: không hoàn tiền, chỉ trả stock
      // Seller sẽ gửi hàng mới sau
      await ReturnModel.findByIdAndUpdate(returnId, {
        $set: {
          refund_status: null, // Không có refund cho exchange
        },
      });
      logger.info("RETURN", "Đổi hàng - không hoàn tiền, chỉ trả stock", {
        returnId,
        returnType: "exchange",
      });
    }

    // 4. Tạo notification cho customer
    const { NotificationModel } = await import(
      "../models/notification.model.js"
    );
    let notificationMessage;
    if (returnDoc.return_type === "refund") {
      notificationMessage = `Yêu cầu trả hàng của bạn đã được hoàn tất. Tiền hoàn lại: ${returnDoc.refund_amount.toLocaleString(
        "vi-VN"
      )} VNĐ đã được chuyển vào ví của bạn.`;
    } else if (returnDoc.return_type === "exchange") {
      notificationMessage = `Yêu cầu đổi hàng của bạn đã được xác nhận. Seller sẽ gửi hàng mới cho bạn sớm nhất.`;
    } else {
      notificationMessage = `Yêu cầu trả hàng của bạn đã được hoàn tất.`;
    }

    await NotificationModel.create({
      user_id: returnDoc.user_id,
      type: "return",
      title:
        returnDoc.return_type === "exchange"
          ? "Yêu cầu đổi hàng đã hoàn tất"
          : "Yêu cầu trả hàng đã hoàn tất",
      message: notificationMessage,
      order_id: returnDoc.order_id.toString(),
      data: {
        return_id: returnId.toString(),
        order_id: returnDoc.order_id.toString(),
        return_type: returnDoc.return_type,
        refund_amount: returnDoc.refund_amount || 0,
      },
    });

    logger.info("RETURN", "Hoàn tất return request", {
      returnId,
      completedBy: currentUser.id,
      refundAmount: returnDoc.refund_amount,
    });

    return formatReturnForFrontend(updated);
  },

  /**
   * Cancel return - Customer hủy return request
   */
  async cancel(returnId, currentUser) {
    const returnDoc = await ReturnModel.findById(returnId).lean();

    if (!returnDoc) {
      throw new Error("Yêu cầu trả hàng không tồn tại");
    }

    if (returnDoc.user_id.toString() !== currentUser.id.toString()) {
      throw new Error("Bạn không có quyền hủy yêu cầu trả hàng này");
    }

    if (returnDoc.status !== "pending") {
      throw new Error(
        `Chỉ có thể hủy yêu cầu trả hàng ở trạng thái 'pending'. Trạng thái hiện tại: ${returnDoc.status}`
      );
    }

    const updated = await ReturnModel.findByIdAndUpdate(
      returnId,
      {
        $set: {
          status: "cancelled",
        },
      },
      { new: true }
    ).lean();

    logger.info("RETURN", "Customer hủy return request", {
      returnId,
      userId: currentUser.id,
    });

    return formatReturnForFrontend(updated);
  },

  /**
   * Create exchange order - Tạo đơn hàng mới cho exchange (seller)
   */
  async createExchangeOrder(returnId, currentUser) {
    const returnDoc = await ReturnModel.findById(returnId)
      .populate("order_id")
      .lean();

    if (!returnDoc) {
      throw new Error("Yêu cầu trả hàng không tồn tại");
    }

    // Kiểm tra quyền
    if (currentUser.role !== ROLES.ADMIN) {
      if (currentUser.role === ROLES.SELLER) {
        const { StoreModel } = await import("../models/store.model.js");
        const store = await StoreModel.findOne({
          _id: returnDoc.store_id,
          owner_id: currentUser.id,
        }).lean();

        if (!store) {
          throw new Error(
            "Bạn không có quyền tạo đơn hàng đổi cho yêu cầu trả hàng này"
          );
        }
      } else {
        throw new Error("Chỉ Seller hoặc Admin mới có quyền tạo đơn hàng đổi");
      }
    }

    // Kiểm tra return_type phải là 'exchange'
    if (returnDoc.return_type !== "exchange") {
      throw new Error("Chỉ có thể tạo đơn hàng đổi cho yêu cầu đổi hàng");
    }

    // Kiểm tra status phải là 'completed'
    if (returnDoc.status !== "completed") {
      throw new Error("Chỉ có thể tạo đơn hàng đổi khi yêu cầu đã hoàn tất");
    }

    // Kiểm tra đã có exchange_order_id chưa
    if (returnDoc.exchange_order_id) {
      throw new Error("Đơn hàng đổi đã được tạo cho yêu cầu này");
    }

    const originalOrder = returnDoc.order_id;
    if (!originalOrder) {
      throw new Error("Không tìm thấy đơn hàng gốc");
    }

    // Tạo order mới cho exchange (miễn phí)
    const { OrderService } = await import("./order.service.js");
    const { genCode } = await import("../utils/order_code.js");

    const { OrderModel } = await import("../models/order.model.js");
    const { OrderItemModel } = await import("../models/order_item.model.js");
    const { OrderTrackingModel } = await import(
      "../models/order_tracking.model.js"
    );

    // Tạo order mới với total = 0 (miễn phí)
    const exchangeOrder = await OrderModel.create({
      code: genCode(),
      buyer_id: returnDoc.user_id,
      store_id: returnDoc.store_id,
      subtotal: 0,
      shipping_fee: 0,
      total: 0,
      status: "processing", // Bắt đầu từ processing vì đã được seller xác nhận
      payment_method: "exchange", // Đánh dấu là exchange order
      discount_code: null,
      discount_amount: 0,
      shipping_code: originalOrder.shipping_code || null,
      shipping_address: originalOrder.shipping_address || null,
    });

    // Tạo order items từ return items
    const exchangeOrderItems = [];
    for (const returnItem of returnDoc.items) {
      const orderItem = await OrderItemModel.create({
        order_id: exchangeOrder._id,
        product_id: returnItem.product_id,
        qty: returnItem.qty,
        unit_price: returnItem.unit_price,
      });
      exchangeOrderItems.push(orderItem);
    }

    // Tạo tracking entry
    await OrderTrackingModel.create({
      order_id: exchangeOrder._id,
      status: "processing",
      description: `Đơn hàng đổi từ yêu cầu trả hàng ${returnDoc._id.toString()}`,
    });

    // Cập nhật return với exchange_order_id
    await ReturnModel.findByIdAndUpdate(returnId, {
      $set: {
        exchange_order_id: exchangeOrder._id,
      },
    });

    // Tạo notification cho customer
    const { NotificationModel } = await import(
      "../models/notification.model.js"
    );
    await NotificationModel.create({
      user_id: returnDoc.user_id,
      type: "order",
      title: "Đơn hàng đổi đã được tạo",
      message: `Seller đã tạo đơn hàng đổi cho yêu cầu của bạn. Đơn hàng ${exchangeOrder.code} sẽ được gửi đến bạn sớm nhất.`,
      order_id: exchangeOrder._id.toString(),
      data: {
        return_id: returnId.toString(),
        order_id: exchangeOrder._id.toString(),
        order_code: exchangeOrder.code,
      },
    });

    logger.info("RETURN", "Tạo exchange order thành công", {
      returnId,
      exchangeOrderId: exchangeOrder._id.toString(),
      createdBy: currentUser.id,
    });

    // Format và trả về order
    const formattedOrder = {
      ...exchangeOrder.toObject(),
      id: exchangeOrder._id.toString(),
      buyer_id: exchangeOrder.buyer_id.toString(),
      store_id: exchangeOrder.store_id.toString(),
      items: exchangeOrderItems.map((item) => ({
        ...item.toObject(),
        id: item._id.toString(),
        order_id: item.order_id.toString(),
        product_id: item.product_id.toString(),
      })),
    };

    return formattedOrder;
  },

  // Hủy return request (chỉ USER có thể hủy return của mình, chỉ khi pending)
  async cancel(returnId, currentUser) {
    logger.info("RETURN", "Đang hủy return request", {
      returnId,
      userId: currentUser.id,
    });

    const returnRequest = await ReturnModel.findById(returnId);

    if (!returnRequest) {
      throw new Error("Yêu cầu trả hàng không tồn tại");
    }

    // Kiểm tra quyền: chỉ user tạo return mới được hủy
    if (returnRequest.user_id.toString() !== currentUser.id) {
      throw new Error("Bạn không có quyền hủy yêu cầu trả hàng này");
    }

    // Chỉ cho phép hủy khi status là pending
    if (returnRequest.status !== "pending") {
      throw new Error(
        "Chỉ có thể hủy yêu cầu đang chờ duyệt. Trạng thái hiện tại: " +
          returnRequest.status
      );
    }

    // Cập nhật status thành cancelled
    returnRequest.status = "cancelled";
    returnRequest.admin_note = "Người dùng đã hủy yêu cầu";
    await returnRequest.save();

    logger.info("RETURN", "Hủy return request thành công", {
      returnId,
      userId: currentUser.id,
    });

    // Populate và format để trả về
    const populatedReturn = await ReturnModel.findById(returnId)
      .populate("user_id", "full_name email phone")
      .populate("order_id", "code status payment_method total_amount")
      .populate("store_id", "name")
      .lean();

    return formatReturnForFrontend(populatedReturn);
  },
};
