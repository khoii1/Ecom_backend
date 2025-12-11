import { OrderModel } from "../models/order.model.js";
import { OrderItemModel } from "../models/order_item.model.js";
import { OrderTrackingModel } from "../models/order_tracking.model.js";
import { ProductModel } from "../models/product.model.js";
import { CartModel } from "../models/cart.model.js";
import { CartItemModel } from "../models/cart_item.model.js";
import { ROLES } from "../constants/roles.js";
import { mongoose } from "../config/database.js";

function genCode() {
  return "OD" + Date.now().toString(36).toUpperCase().slice(-8);
}

export const OrderService = {
  async createFromCart(user_id, discount_id = null, payment_method = "cash") {
    // Không dùng transaction trong development (standalone MongoDB không hỗ trợ)
    const useTransaction =
      process.env.NODE_ENV === "production" &&
      process.env.USE_MONGODB_TRANSACTIONS === "true";

    let session = null;
    if (useTransaction) {
      session = await mongoose.startSession();
      await session.startTransaction();
    }

    try {
      // 1. Lấy cart và cart items
      const cartQuery = CartModel.findOne({ user_id });
      if (session) cartQuery.session(session);
      const cart = await cartQuery.lean();

      if (!cart) {
        throw new Error("Giỏ hàng trống");
      }

      const cartItemsQuery = CartItemModel.find({ cart_id: cart._id }).populate(
        "product_id"
      );
      if (session) cartItemsQuery.session(session);
      const cartItems = await cartItemsQuery.lean();

      if (!cartItems || cartItems.length === 0) {
        throw new Error("Giỏ hàng trống");
      }

      // 2. Lấy store_id từ sản phẩm đầu tiên (giả định tất cả sản phẩm cùng store)
      const firstProduct = cartItems[0].product_id;
      if (!firstProduct) {
        throw new Error("Sản phẩm không tồn tại");
      }

      const store_id = firstProduct.store_id;

      // 3. Kiểm tra tồn kho và tính toán subtotal
      let calculatedSubtotal = 0;
      const orderItemsData = [];

      // Reserve products - lấy fresh data từ DB để check
      const productIds = cartItems.map((item) => item.product_id._id);
      const productsQuery = ProductModel.find({ _id: { $in: productIds } });
      if (session) productsQuery.session(session);
      const products = await productsQuery.lean();
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      for (const item of cartItems) {
        const product = productMap.get(item.product_id._id.toString());
        if (!product) {
          throw new Error("Sản phẩm không tồn tại");
        }

        if (product.status !== "active") {
          throw new Error(`Sản phẩm "${product.title}" hiện không khả dụng`);
        }

        // Kiểm tra tồn kho (tính available = stock - reserved)
        const requestedQty = item.qty;
        const currentStock = product.stock_quantity ?? 0;
        const reservedQty = product.reserved_quantity ?? 0;
        const availableStock = Math.max(0, currentStock - reservedQty);

        if (requestedQty > availableStock) {
          throw new Error(
            `Sản phẩm "${product.title}" chỉ còn ${availableStock} sản phẩm có sẵn (tổng kho: ${currentStock}, đang giữ: ${reservedQty}). Bạn đang yêu cầu ${requestedQty} sản phẩm.`
          );
        }

        const price = parseFloat(product.price);
        const discount = parseFloat(product.discount_percentage || 0);
        const finalUnitPrice = ProductModel.calculateFinalPrice(
          price,
          discount
        );
        calculatedSubtotal += finalUnitPrice * requestedQty;

        orderItemsData.push({
          product_id: product._id,
          unit_price: finalUnitPrice,
          qty: requestedQty,
        });
      }

      // 4. Áp dụng discount code nếu có
      let discountCode = null;
      let discountAmount = 0;
      let finalTotal = calculatedSubtotal;

      if (discount_id) {
        const { DiscountModel } = await import("../models/discount.model.js");
        const discount = await DiscountModel.findById(discount_id)
          .session(session)
          .lean();

        if (discount && discount.is_active) {
          // Lấy category_ids từ các sản phẩm trong cart
          const productCategoryIds = cartItems
            .map((item) => item.product_id?.category_id)
            .filter(Boolean)
            .map((id) => id.toString());

          const validation = await DiscountModel.validateCode(
            discount.code,
            calculatedSubtotal,
            user_id,
            productCategoryIds
          );

          if (validation.valid) {
            discountCode = discount.code;
            discountAmount = validation.discountAmount;
            finalTotal = Math.max(0, calculatedSubtotal - discountAmount);
            finalTotal = Math.round(finalTotal * 100) / 100;
          }
        }
      }

      // 5. Xử lý thanh toán bằng ví (nếu payment_method = "wallet")
      let orderStatus = "pending";
      let reservedUntil = null;

      if (payment_method === "wallet") {
        // Kiểm tra và trừ tiền từ ví
        const { WalletService } = await import("./wallet.service.js");
        try {
          await WalletService.deduct(
            user_id,
            finalTotal,
            null, // referenceId sẽ được cập nhật sau khi tạo order
            "order",
            `Thanh toán đơn hàng: ${finalTotal.toLocaleString("vi-VN")} VNĐ`
          );
          // Nếu trừ tiền thành công, đặt status = "paid" ngay
          orderStatus = "paid";
          logger.info("ORDER", "Thanh toán bằng ví thành công", {
            userId: user_id,
            amount: finalTotal,
          });
        } catch (walletError) {
          logger.error("ORDER", "Thanh toán bằng ví thất bại", {
            userId: user_id,
            error: walletError.message,
          });
          throw new Error(walletError.message);
        }
      } else {
        // Thanh toán bằng cash hoặc vnpay: đặt reserved_until = 10 phút
        reservedUntil = new Date();
        reservedUntil.setMinutes(reservedUntil.getMinutes() + 10);
      }

      // 6. Tạo Order
      const orderData = {
        code: genCode(),
        buyer_id: user_id,
        store_id,
        subtotal: calculatedSubtotal,
        total: finalTotal,
        status: orderStatus,
        payment_method: payment_method,
        reserved_until: reservedUntil,
        discount_code: discountCode,
        discount_amount: discountAmount,
      };

      const order = session
        ? await OrderModel.create([orderData], { session })
        : await OrderModel.create(orderData);

      const createdOrder = Array.isArray(order) ? order[0] : order;

      // Nếu thanh toán bằng ví thành công, cập nhật reference_id cho wallet transaction
      if (payment_method === "wallet" && orderStatus === "paid") {
        const { WalletTransactionModel } = await import("../models/wallet_transaction.model.js");
        await WalletTransactionModel.findOneAndUpdate(
          {
            user_id: user_id,
            type: "payment",
            reference_id: null,
            status: "completed",
          },
          {
            $set: {
              reference_id: createdOrder._id.toString(),
            },
          },
          {
            sort: { createdAt: -1 }, // Lấy transaction mới nhất
          }
        );
      }

      // 7. Tạo tracking record ban đầu
      const trackingData = {
        order_id: createdOrder._id,
        status: orderStatus,
        description: orderStatus === "paid" 
          ? "Đơn hàng đã được tạo và thanh toán bằng ví thành công"
          : "Đơn hàng đã được tạo",
      };

      if (session) {
        await OrderTrackingModel.create([trackingData], { session });
      } else {
        await OrderTrackingModel.create(trackingData);
      }

      // 8. Tạo OrderItems
      const orderItemsToCreate = orderItemsData.map((itemData) => ({
        order_id: createdOrder._id,
        product_id: itemData.product_id,
        unit_price: itemData.unit_price,
        qty: itemData.qty,
      }));

      if (session) {
        await OrderItemModel.insertMany(orderItemsToCreate, { session });
      } else {
        await OrderItemModel.insertMany(orderItemsToCreate);
      }

      // 9. Xử lý stock
      if (orderStatus === "paid") {
        // Nếu đã thanh toán (ví), giảm stock ngay và không cần reserve
        for (const itemData of orderItemsData) {
          const updateQuery = ProductModel.findByIdAndUpdate(
            itemData.product_id,
            {
              $inc: {
                stock_quantity: -itemData.qty,
                reserved_quantity: 0, // Không reserve vì đã thanh toán
              },
            }
          );
          if (session) updateQuery.session(session);
          await updateQuery;
        }
      } else {
        // Nếu chưa thanh toán (cash/vnpay), chỉ reserve stock
        for (const itemData of orderItemsData) {
          const updateQuery = ProductModel.findByIdAndUpdate(
            itemData.product_id,
            { $inc: { reserved_quantity: itemData.qty } }
          );
          if (session) updateQuery.session(session);
          await updateQuery;
        }
      }

      // 10. Xóa cart items
      const deleteQuery = CartItemModel.deleteMany({ cart_id: cart._id });
      if (session) deleteQuery.session(session);
      await deleteQuery;

      // 11. Ghi nhận việc sử dụng discount code nếu có
      if (discount_id && discountCode) {
        const { DiscountModel, DiscountUsageModel } = await import(
          "../models/discount.model.js"
        );
        const discountUpdateQuery = DiscountModel.findByIdAndUpdate(
          discount_id,
          { $inc: { used_count: 1 } }
        );
        if (session) discountUpdateQuery.session(session);
        await discountUpdateQuery;

        const usageData = {
          discount_id,
          user_id,
          order_id: createdOrder._id,
        };

        if (session) {
          await DiscountUsageModel.create([usageData], { session });
        } else {
          await DiscountUsageModel.create(usageData);
        }
      }

      if (session) {
        await session.commitTransaction();
      }

      return {
        ...createdOrder.toObject(),
        id: createdOrder._id.toString(),
        buyer_id: createdOrder.buyer_id.toString(),
        store_id: createdOrder.store_id.toString(),
      };
    } catch (e) {
      if (session) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error("Error aborting transaction:", abortError);
        }
      }
      console.error("Error creating order from cart:", e);
      throw new Error(`Không thể tạo đơn hàng: ${e.message}`);
    } finally {
      if (session) {
        try {
          await session.endSession();
        } catch (endError) {
          console.error("Error ending session:", endError);
        }
      }
    }
  },

  async listMyOrders(user_id) {
    const orders = await OrderModel.find({ buyer_id: user_id })
      .populate({
        path: "order_items",
        populate: {
          path: "product_id",
          select: "image_url",
        },
        options: { limit: 1, sort: { _id: 1 } },
      })
      .sort({ createdAt: -1 })
      .lean();

    return orders.map((order) => {
      const firstItemImage =
        order.order_items?.[0]?.product_id?.image_url || null;
      return {
        ...order,
        id: order._id.toString(),
        buyer_id: order.buyer_id.toString(),
        store_id: order.store_id.toString(),
        first_item_image_url: firstItemImage,
      };
    });
  },

  async listByStore(store_id) {
    const orders = await OrderModel.find({ store_id })
      .populate("buyer_id", "full_name email")
      .populate({
        path: "order_items",
        populate: {
          path: "product_id",
          select: "image_url",
        },
        options: { limit: 1, sort: { _id: 1 } },
      })
      .sort({ createdAt: -1 })
      .lean();

    return orders.map((order) => {
      const buyer = order.buyer_id;
      const firstItemImage =
        order.order_items?.[0]?.product_id?.image_url || null;

      return {
        ...order,
        id: order._id.toString(),
        buyer_id: order.buyer_id.toString(),
        store_id: order.store_id.toString(),
        buyer_name: buyer?.full_name || null,
        buyer_email: buyer?.email || null,
        first_item_image_url: firstItemImage,
      };
    });
  },

  async detail(order_id) {
    const order = await OrderModel.findById(order_id)
      .populate({
        path: "order_items",
        populate: {
          path: "product_id",
          select: "title image_url",
        },
      })
      .populate("shipping_address")
      .populate("shipper_id", "full_name email")
      .lean();

    if (!order) return null;

    // Lấy tracking history
    const trackingHistory = await OrderTrackingModel.find({ order_id })
      .sort({ tracked_at: 1 })
      .lean();

    const items = order.order_items.map((item) => ({
      ...item,
      id: item._id.toString(),
      order_id: item.order_id.toString(),
      product_id: item.product_id?._id.toString() || item.product_id.toString(),
      product_title: item.product_id?.title || null,
      product_image_url: item.product_id?.image_url || null,
    }));

    return {
      ...order,
      id: order._id.toString(),
      buyer_id: order.buyer_id.toString(),
      store_id: order.store_id.toString(),
      shipper_id:
        order.shipper_id?._id?.toString() ||
        order.shipper_id?.toString() ||
        null,
      shipper_name: order.shipper_id?.full_name || null,
      items: items,
      tracking: trackingHistory.map((t) => ({
        id: t._id.toString(),
        status: t.status,
        description: t.description,
        location: t.location,
        note: t.note,
        tracked_at: t.tracked_at,
      })),
      shipping_address: order.shipping_address
        ? {
            ...order.shipping_address,
            id: order.shipping_address._id.toString(),
          }
        : null,
      delivery_proof_image: order.delivery_proof_image || null,
      delivery_confirmed_by_customer:
        order.delivery_confirmed_by_customer || false,
      delivery_confirmed_at: order.delivery_confirmed_at || null,
      delivery_note: order.delivery_note || null,
    };
  },

  async updateStatus(order_id, status, currentUser, trackingInfo = {}) {
    const order = await this.detail(order_id);
    if (!order) return null;

    // Kiểm tra quyền
    let isAuthorized = false;
    if (currentUser.role === ROLES.ADMIN) {
      isAuthorized = true;
    } else if (currentUser.role === ROLES.SELLER) {
      const { StoreModel } = await import("../models/store.model.js");
      const store = await StoreModel.findById(order.store_id).lean();
      if (store && store.owner_id.toString() === currentUser.id.toString()) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error("Bạn không có quyền cập nhật đơn hàng này");
    }

    // Validate status
    const validStatuses = [
      "pending",
      "paid",
      "payment_failed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      throw new Error(`Trạng thái "${status}" không hợp lệ.`);
    }

    // Khi chuyển sang "paid": giảm stock từ reserved_quantity
    if (status === "paid" && order.status === "pending") {
      const { OrderItemModel } = await import("../models/order_item.model.js");
      const { ProductModel } = await import("../models/product.model.js");

      const orderItems = await OrderItemModel.find({ order_id }).lean();
      for (const item of orderItems) {
        // Lấy thông tin product hiện tại để kiểm tra reserved_quantity
        const product = await ProductModel.findById(item.product_id).lean();
        
        // Luôn giảm stock_quantity (stock thực tế)
        const updateData = {
          $inc: {
            stock_quantity: -item.qty,
          },
        };
        
        // Chỉ giảm reserved_quantity nếu nó > 0 (còn reservation)
        // Nếu reserved_quantity = 0 (đã trả lại sau 10 phút), không giảm nữa
        if (product && product.reserved_quantity > 0) {
          updateData.$inc.reserved_quantity = -item.qty;
        }
        
        await ProductModel.findByIdAndUpdate(item.product_id, updateData);
      }
    }

    // Khi cancel order: trả lại reserved stock (chỉ khi đang pending)
    if (status === "cancelled" && order.status === "pending") {
      const { OrderItemModel } = await import("../models/order_item.model.js");
      const { ProductModel } = await import("../models/product.model.js");

      const orderItems = await OrderItemModel.find({ order_id }).lean();
      for (const item of orderItems) {
        // Chỉ giảm reserved_quantity, không giảm stock_quantity
        await ProductModel.findByIdAndUpdate(item.product_id, {
          $inc: { reserved_quantity: -item.qty },
        });
      }
    }

    // Status descriptions mapping
    const statusDescriptions = {
      pending: "Đơn hàng đã được tạo, chờ thanh toán",
      paid: "Đơn hàng đã được thanh toán",
      payment_failed: "Thanh toán thất bại",
      processing: "Đơn hàng đang được xử lý",
      shipped: "Đơn hàng đã được vận chuyển",
      delivered: "Đơn hàng đã được giao thành công",
      cancelled: "Đơn hàng đã bị hủy",
    };

    // Cập nhật trạng thái
    const updateData = { status };
    if (trackingInfo.tracking_number) {
      updateData.tracking_number = trackingInfo.tracking_number;
    }
    if (trackingInfo.shipping_method) {
      updateData.shipping_method = trackingInfo.shipping_method;
    }

    const updatedOrder = await OrderModel.findByIdAndUpdate(
      order_id,
      { $set: updateData },
      { new: true }
    ).lean();

    if (!updatedOrder) return null;

    // Tạo tracking record
    await OrderTrackingModel.create({
      order_id,
      status,
      description:
        trackingInfo.description ||
        statusDescriptions[status] ||
        `Trạng thái đơn hàng: ${status}`,
      location: trackingInfo.location || null,
      note: trackingInfo.note || null,
    });

    // Lấy lại items
    const fullOrder = await this.detail(order_id);

    return {
      ...updatedOrder,
      id: updatedOrder._id.toString(),
      buyer_id: updatedOrder.buyer_id.toString(),
      store_id: updatedOrder.store_id.toString(),
      items: fullOrder?.items || [],
      tracking: fullOrder?.tracking || [],
    };
  },
};
