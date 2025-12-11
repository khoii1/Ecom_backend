import { ReturnModel } from '../models/return.model.js';
import { OrderModel } from '../models/order.model.js';
import { OrderItemModel } from '../models/order_item.model.js';
import { ProductModel } from '../models/product.model.js';
import { ROLES } from '../constants/roles.js';
import { logger } from '../utils/logger.js';

// Helper function để format return cho frontend
const formatReturnForFrontend = (returnDoc) => {
  if (!returnDoc) return returnDoc;
  
  return {
    ...returnDoc,
    id: returnDoc._id.toString(),
    order_id: returnDoc.order_id?.toString() || returnDoc.order_id.toString(),
    user_id: returnDoc.user_id?.toString() || returnDoc.user_id.toString(),
    store_id: returnDoc.store_id?.toString() || returnDoc.store_id.toString(),
  };
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
    const { order_id, return_type, reason, description, items, images } = payload;

    // 1. Kiểm tra order tồn tại và thuộc về user
    const order = await OrderModel.findById(order_id)
      .populate('order_items')
      .lean();

    if (!order) {
      throw new Error('Đơn hàng không tồn tại');
    }

    if (order.buyer_id.toString() !== currentUser.id.toString()) {
      throw new Error('Bạn không có quyền trả hàng cho đơn hàng này');
    }

    // 2. Kiểm tra điều kiện trả hàng
    if (order.status !== 'delivered') {
      throw new Error(
        `Chỉ có thể trả hàng khi đơn hàng đã được giao. Trạng thái hiện tại: ${order.status}`
      );
    }

    if (!order.delivery_confirmed_by_customer) {
      throw new Error('Bạn cần xác nhận đã nhận hàng trước khi trả hàng');
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
      status: { $in: ['pending', 'approved', 'processing'] },
    }).lean();

    if (existingReturn) {
      throw new Error(
        `Đã có yêu cầu trả hàng đang được xử lý cho đơn hàng này (Status: ${existingReturn.status})`
      );
    }

    // 5. Validate items
    if (!items || items.length === 0) {
      throw new Error('Phải có ít nhất một sản phẩm để trả hàng');
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
      return_type: return_type || 'refund',
      reason,
      description: description || null,
      items: returnItems,
      refund_amount: finalRefundAmount,
      refund_method: order.payment_method === 'vnpay' ? 'original' : 'bank_transfer',
      images: images || [],
      status: 'pending',
    });

    // 8. Tạo notification cho seller
    const { NotificationModel } = await import('../models/notification.model.js');
    const { StoreModel } = await import('../models/store.model.js');

    const store = await StoreModel.findById(order.store_id)
      .populate('owner_id')
      .lean();

    if (store?.owner_id) {
      await NotificationModel.create({
        user_id: store.owner_id._id,
        type: 'return',
        title: 'Yêu cầu trả hàng mới',
        message: `Khách hàng yêu cầu trả hàng cho đơn hàng ${order.code}. Lý do: ${reason}`,
        order_id: order_id.toString(),
        data: {
          return_id: returnRequest._id.toString(),
          order_code: order.code,
          order_id: order_id.toString(),
        },
      });
    }

    logger.info('RETURN', 'Tạo return request thành công', {
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
      .populate('order_id', 'code status total')
      .populate('store_id', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return formatReturnsForFrontend(returns);
  },

  /**
   * Lấy danh sách returns của store (seller)
   */
  async listByStore(storeId) {
    const returns = await ReturnModel.find({ store_id: storeId })
      .populate('order_id', 'code status total')
      .populate('user_id', 'full_name email')
      .sort({ createdAt: -1 })
      .lean();

    return formatReturnsForFrontend(returns);
  },

  /**
   * Chi tiết return
   */
  async detail(returnId, currentUser) {
    const returnDoc = await ReturnModel.findById(returnId)
      .populate('order_id')
      .populate('user_id', 'full_name email')
      .populate('store_id', 'name owner_id')
      .populate({
        path: 'items.product_id',
        select: 'title image_url',
      })
      .lean();

    if (!returnDoc) {
      throw new Error('Yêu cầu trả hàng không tồn tại');
    }

    // Kiểm tra quyền truy cập
    const isOwner = returnDoc.user_id.toString() === currentUser.id.toString();
    let isStoreOwner = false;
    if (currentUser.role === ROLES.SELLER) {
      const { StoreModel } = await import('../models/store.model.js');
      const store = await StoreModel.findOne({
        _id: returnDoc.store_id,
        owner_id: currentUser.id,
      }).lean();
      isStoreOwner = !!store;
    }
    const isAdmin = currentUser.role === ROLES.ADMIN;

    if (!isOwner && !isStoreOwner && !isAdmin) {
      throw new Error('Bạn không có quyền xem yêu cầu trả hàng này');
    }

    return formatReturnForFrontend(returnDoc);
  },

  /**
   * Approve return - Seller/Admin
   */
  async approve(returnId, currentUser, adminNote) {
    const returnDoc = await ReturnModel.findById(returnId).lean();

    if (!returnDoc) {
      throw new Error('Yêu cầu trả hàng không tồn tại');
    }

    // Kiểm tra quyền
    if (currentUser.role !== ROLES.ADMIN) {
      if (currentUser.role === ROLES.SELLER) {
        const { StoreModel } = await import('../models/store.model.js');
        const store = await StoreModel.findOne({
          _id: returnDoc.store_id,
          owner_id: currentUser.id,
        }).lean();

        if (!store) {
          throw new Error('Bạn không có quyền duyệt yêu cầu trả hàng này');
        }
      } else {
        throw new Error('Chỉ Seller hoặc Admin mới có quyền duyệt yêu cầu trả hàng');
      }
    }

    if (returnDoc.status !== 'pending') {
      throw new Error(
        `Chỉ có thể duyệt yêu cầu trả hàng ở trạng thái 'pending'. Trạng thái hiện tại: ${returnDoc.status}`
      );
    }

    // Cập nhật status
    const updated = await ReturnModel.findByIdAndUpdate(
      returnId,
      {
        $set: {
          status: 'approved',
          admin_note: adminNote || null,
          processed_at: new Date(),
        },
      },
      { new: true }
    ).lean();

    // Tạo notification cho customer
    const { NotificationModel } = await import('../models/notification.model.js');
    await NotificationModel.create({
      user_id: returnDoc.user_id,
      type: 'return',
      title: 'Yêu cầu trả hàng đã được duyệt',
      message: `Yêu cầu trả hàng của bạn đã được duyệt. Vui lòng gửi hàng về theo hướng dẫn.`,
      order_id: returnDoc.order_id.toString(),
      data: {
        return_id: returnId.toString(),
        order_id: returnDoc.order_id.toString(),
      },
    });

    logger.info('RETURN', 'Duyệt return request thành công', {
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
      throw new Error('Yêu cầu trả hàng không tồn tại');
    }

    // Kiểm tra quyền (tương tự approve)
    if (currentUser.role !== ROLES.ADMIN) {
      if (currentUser.role === ROLES.SELLER) {
        const { StoreModel } = await import('../models/store.model.js');
        const store = await StoreModel.findOne({
          _id: returnDoc.store_id,
          owner_id: currentUser.id,
        }).lean();

        if (!store) {
          throw new Error('Bạn không có quyền từ chối yêu cầu trả hàng này');
        }
      } else {
        throw new Error('Chỉ Seller hoặc Admin mới có quyền từ chối yêu cầu trả hàng');
      }
    }

    if (returnDoc.status !== 'pending') {
      throw new Error(
        `Chỉ có thể từ chối yêu cầu trả hàng ở trạng thái 'pending'. Trạng thái hiện tại: ${returnDoc.status}`
      );
    }

    if (!adminNote) {
      throw new Error('Vui lòng cung cấp lý do từ chối');
    }

    // Cập nhật status
    const updated = await ReturnModel.findByIdAndUpdate(
      returnId,
      {
        $set: {
          status: 'rejected',
          admin_note: adminNote,
          processed_at: new Date(),
        },
      },
      { new: true }
    ).lean();

    // Tạo notification cho customer
    const { NotificationModel } = await import('../models/notification.model.js');
    await NotificationModel.create({
      user_id: returnDoc.user_id,
      type: 'return',
      title: 'Yêu cầu trả hàng bị từ chối',
      message: `Yêu cầu trả hàng của bạn đã bị từ chối. Lý do: ${adminNote}`,
      order_id: returnDoc.order_id.toString(),
      data: {
        return_id: returnId.toString(),
        order_id: returnDoc.order_id.toString(),
      },
    });

    logger.info('RETURN', 'Từ chối return request', {
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
      throw new Error('Yêu cầu trả hàng không tồn tại');
    }

    // Kiểm tra quyền (tương tự approve)
    if (currentUser.role !== ROLES.ADMIN) {
      if (currentUser.role === ROLES.SELLER) {
        const { StoreModel } = await import('../models/store.model.js');
        const store = await StoreModel.findOne({
          _id: returnDoc.store_id,
          owner_id: currentUser.id,
        }).lean();

        if (!store) {
          throw new Error('Bạn không có quyền xử lý yêu cầu trả hàng này');
        }
      } else {
        throw new Error('Chỉ Seller hoặc Admin mới có quyền xử lý yêu cầu trả hàng');
      }
    }

    if (returnDoc.status !== 'approved') {
      throw new Error(
        `Chỉ có thể xử lý yêu cầu trả hàng ở trạng thái 'approved'. Trạng thái hiện tại: ${returnDoc.status}`
      );
    }

    // Cập nhật status
    const updated = await ReturnModel.findByIdAndUpdate(
      returnId,
      {
        $set: {
          status: 'processing',
        },
      },
      { new: true }
    ).lean();

    logger.info('RETURN', 'Chuyển return sang processing', {
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
      throw new Error('Yêu cầu trả hàng không tồn tại');
    }

    // Kiểm tra quyền (tương tự approve)
    if (currentUser.role !== ROLES.ADMIN) {
      if (currentUser.role === ROLES.SELLER) {
        const { StoreModel } = await import('../models/store.model.js');
        const store = await StoreModel.findOne({
          _id: returnDoc.store_id,
          owner_id: currentUser.id,
        }).lean();

        if (!store) {
          throw new Error('Bạn không có quyền hoàn tất yêu cầu trả hàng này');
        }
      } else {
        throw new Error('Chỉ Seller hoặc Admin mới có quyền hoàn tất yêu cầu trả hàng');
      }
    }

    if (returnDoc.status !== 'processing') {
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

    logger.info('RETURN', 'Đã trả lại stock', {
      returnId,
      itemsCount: returnDoc.items.length,
    });

    // 2. Cập nhật return status
    const updated = await ReturnModel.findByIdAndUpdate(
      returnId,
      {
        $set: {
          status: 'completed',
          refund_status: 'processing', // Bắt đầu xử lý hoàn tiền
          completed_at: new Date(),
        },
      },
      { new: true }
    ).lean();

    // 3. Xử lý hoàn tiền vào ví
    if (returnDoc.refund_method === "wallet" || returnDoc.refund_method === null) {
      // Mặc định hoàn tiền vào ví nếu không chỉ định phương thức khác
      try {
        const { WalletService } = await import("./wallet.service.js");
        await WalletService.add(
          returnDoc.user_id.toString(),
          returnDoc.refund_amount,
          returnId.toString(),
          "return",
          `Hoàn tiền từ yêu cầu trả hàng: ${returnDoc.refund_amount.toLocaleString("vi-VN")} VNĐ`
        );

        // Cập nhật refund_status = completed
        await ReturnModel.findByIdAndUpdate(returnId, {
          $set: {
            refund_status: "completed",
            refund_method: "wallet", // Đảm bảo refund_method được set
          },
        });

        logger.info("RETURN", "Đã hoàn tiền vào ví", {
          returnId,
          userId: returnDoc.user_id.toString(),
          amount: returnDoc.refund_amount,
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
      logger.info("RETURN", "Hoàn tiền về phương thức gốc (cần xử lý thủ công)", {
        returnId,
      });
    }

    // 4. Tạo notification cho customer
    const { NotificationModel } = await import('../models/notification.model.js');
    await NotificationModel.create({
      user_id: returnDoc.user_id,
      type: 'return',
      title: 'Yêu cầu trả hàng đã hoàn tất',
      message: `Yêu cầu trả hàng của bạn đã được hoàn tất. Tiền hoàn lại: ${returnDoc.refund_amount.toLocaleString('vi-VN')} VNĐ`,
      order_id: returnDoc.order_id.toString(),
      data: {
        return_id: returnId.toString(),
        order_id: returnDoc.order_id.toString(),
        refund_amount: returnDoc.refund_amount,
      },
    });

    logger.info('RETURN', 'Hoàn tất return request', {
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
      throw new Error('Yêu cầu trả hàng không tồn tại');
    }

    if (returnDoc.user_id.toString() !== currentUser.id.toString()) {
      throw new Error('Bạn không có quyền hủy yêu cầu trả hàng này');
    }

    if (returnDoc.status !== 'pending') {
      throw new Error(
        `Chỉ có thể hủy yêu cầu trả hàng ở trạng thái 'pending'. Trạng thái hiện tại: ${returnDoc.status}`
      );
    }

    const updated = await ReturnModel.findByIdAndUpdate(
      returnId,
      {
        $set: {
          status: 'cancelled',
        },
      },
      { new: true }
    ).lean();

    logger.info('RETURN', 'Customer hủy return request', {
      returnId,
      userId: currentUser.id,
    });

    return formatReturnForFrontend(updated);
  },
};

