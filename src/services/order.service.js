import { OrderModel } from "../models/order.model.js";
import { OrderItemModel } from "../models/order_item.model.js";
import { OrderTrackingModel } from "../models/order_tracking.model.js";
import { ProductModel } from "../models/product.model.js";
import { CartModel } from "../models/cart.model.js";
import { CartItemModel } from "../models/cart_item.model.js";
import { ROLES } from "../constants/roles.js";
import { mongoose } from "../config/database.js";
import logger from "../utils/logger.js";

function genCode() {
  return "OD" + Date.now().toString(36).toUpperCase().slice(-8);
}

export const OrderService = {
  async createFromCart(
    user_id,
    discount_id = null,
    payment_method = "cash",
    shipping_code = null,
    shipping_address_id = null,
    shipping_fee = 0
  ) {
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

      // 4. Tính shipping fee nếu có
      let calculatedShippingFee = shipping_fee || 0;
      if (shipping_code && shipping_address_id) {
        try {
          const { ShippingService } = await import("./shipping.service.js");
          const { AddressModel } = await import("../models/address.model.js");
          const { StoreModel } = await import("../models/store.model.js");

          const destination = await AddressModel.findById(
            shipping_address_id
          ).lean();
          const store = await StoreModel.findById(store_id).lean();

          if (destination && store) {
            // Tính trọng lượng ước tính (1kg/sản phẩm)
            const estimatedWeight = cartItems.reduce(
              (sum, item) => sum + item.qty,
              0
            );

            // Lấy tọa độ store nếu có (có thể cần thêm vào store model)
            const origin =
              store.lat && store.lon
                ? {
                    lat: store.lat,
                    lon: store.lon,
                    address: store.address || "",
                  }
                : null;

            // Tạo địa chỉ đầy đủ từ các field
            const fullAddress = `${destination.street || ""}, ${
              destination.ward || ""
            }, ${destination.district || ""}, ${
              destination.province || ""
            }`.trim();

            const shippingResult = await ShippingService.calculateShippingFee(
              shipping_code,
              {
                origin,
                destination: {
                  lat: destination.lat || null,
                  lon: destination.lon || null,
                  address: fullAddress,
                },
                weight: estimatedWeight || 1,
                totalValue: calculatedSubtotal,
              }
            );

            calculatedShippingFee = shippingResult.calculated_fee;
          }
        } catch (error) {
          logger.warn(
            "ORDER",
            `Không thể tính shipping fee: ${error.message}`,
            { shipping_code }
          );
          // Nếu tính shipping fee thất bại, dùng giá trị mặc định
          calculatedShippingFee = shipping_fee || 0;
        }
      }

      // 5. Áp dụng discount code nếu có
      let discountCode = null;
      let discountAmount = 0;
      let finalTotal = calculatedSubtotal + calculatedShippingFee;

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
            // Discount chỉ áp dụng cho subtotal, không áp dụng cho shipping
            finalTotal = Math.max(
              calculatedShippingFee,
              calculatedSubtotal - discountAmount + calculatedShippingFee
            );
            finalTotal = Math.round(finalTotal * 100) / 100;
          }
        }
      }

      // 6. Xử lý thanh toán bằng ví (nếu payment_method = "wallet")
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

      // 7. Tạo Order
      const orderData = {
        code: genCode(),
        buyer_id: user_id,
        store_id,
        subtotal: calculatedSubtotal,
        shipping_fee: calculatedShippingFee,
        shipping_code: shipping_code || null,
        shipping_address: shipping_address_id || null,
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
        const { WalletTransactionModel } = await import(
          "../models/wallet_transaction.model.js"
        );
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

      // 8. Cộng tiền vào ví seller nếu thanh toán thành công
      if (orderStatus === "paid") {
        try {
          const { StoreModel } = await import("../models/store.model.js");
          const { WalletService } = await import("./wallet.service.js");

          const store = await StoreModel.findById(createdOrder.store_id).lean();
          if (store && store.owner_id) {
            const sellerId = store.owner_id.toString();
            const sellerAmount = createdOrder.total;

            await WalletService.add(
              sellerId,
              sellerAmount,
              createdOrder._id.toString(),
              "order",
              `Thanh toán đơn hàng ${
                createdOrder.code
              }: ${sellerAmount.toLocaleString("vi-VN")} VNĐ`
            );

            logger.info("ORDER", `Đã cộng tiền vào ví seller khi tạo order`, {
              orderId: createdOrder._id.toString(),
              sellerId,
              amount: sellerAmount,
            });
          }
        } catch (walletError) {
          logger.error(
            "ORDER",
            `Lỗi khi cộng tiền vào ví seller khi tạo order`,
            {
              orderId: createdOrder._id.toString(),
              error: walletError.message,
            }
          );
        }
      }

      // 9. Tạo tracking record ban đầu
      const trackingData = {
        order_id: createdOrder._id,
        status: orderStatus,
        description:
          orderStatus === "paid"
            ? "Đơn hàng đã được tạo và thanh toán bằng ví thành công"
            : "Đơn hàng đã được tạo",
      };

      if (session) {
        await OrderTrackingModel.create([trackingData], { session });
      } else {
        await OrderTrackingModel.create(trackingData);
      }

      // 9. Tạo OrderItems
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

      // 10. Xử lý stock
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

      // 11. Xóa cart items
      const deleteQuery = CartItemModel.deleteMany({ cart_id: cart._id });
      if (session) deleteQuery.session(session);
      await deleteQuery;

      // 12. Gửi email notification cho customer
      try {
        const { UserModel } = await import("../models/user.model.js");
        const buyer = await UserModel.findById(user_id).lean();
        if (buyer && buyer.email) {
          const { sendOrderEmail } = await import("../utils/order_email.js");
          await sendOrderEmail(
            buyer.email,
            {
              code: createdOrder.code,
              total: finalTotal,
              payment_method: payment_method,
              status: orderStatus,
            },
            "order_created"
          );
        }
      } catch (emailError) {
        logger.warn("ORDER", "Không thể gửi email notification", {
          error: emailError.message,
          orderId: createdOrder._id.toString(),
        });
      }

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

      // 12. Tạo notification cho seller về đơn hàng mới
      try {
        const { StoreModel } = await import("../models/store.model.js");
        const { NotificationModel } = await import(
          "../models/notification.model.js"
        );
        const { UserModel } = await import("../models/user.model.js");

        const store = await StoreModel.findById(createdOrder.store_id)
          .populate("owner_id")
          .lean();

        if (store?.owner_id) {
          const buyer = await UserModel.findById(user_id).lean();
          const buyerName = buyer?.full_name || "Khách hàng";

          await NotificationModel.create({
            user_id: store.owner_id._id,
            type: "order",
            title: "Đơn hàng mới",
            message: `Bạn có đơn hàng mới ${
              createdOrder.code
            } từ ${buyerName}. Tổng tiền: ${finalTotal.toLocaleString(
              "vi-VN"
            )} VNĐ`,
            order_id: createdOrder._id,
            data: {
              order_id: createdOrder._id.toString(),
              order_code: createdOrder.code,
              buyer_name: buyerName,
              total: finalTotal,
              status: orderStatus,
            },
          });

          logger.info("ORDER", "Đã tạo notification cho seller", {
            orderId: createdOrder._id.toString(),
            sellerId: store.owner_id._id.toString(),
            orderCode: createdOrder.code,
          });
        }
      } catch (notificationError) {
        logger.warn("ORDER", "Không thể tạo notification cho seller", {
          error: notificationError.message,
          orderId: createdOrder._id.toString(),
        });
        // Không throw error vì notification không quan trọng bằng việc tạo order
      }

      if (session) {
        await session.commitTransaction();
      }

      // 13. Emit socket event để cập nhật real-time cho seller
      try {
        const { emitOrderCreated } = await import("../socket/order.socket.js");

        // Lấy thông tin order đầy đủ để gửi qua socket
        const fullOrder = await OrderModel.findById(createdOrder._id)
          .populate({
            path: "order_items",
            populate: {
              path: "product_id",
              select: "title image_url price discount_percentage",
            },
          })
          .populate("buyer_id", "full_name email")
          .populate("store_id", "name")
          .lean();

        if (fullOrder) {
          // Format data để gửi qua socket
          const socketOrderData = {
            id: fullOrder._id.toString(),
            code: fullOrder.code,
            status: fullOrder.status,
            total: fullOrder.total,
            subtotal: fullOrder.subtotal,
            shipping_fee: fullOrder.shipping_fee,
            payment_method: fullOrder.payment_method,
            created_at: fullOrder.created_at,
            buyer: {
              id: fullOrder.buyer_id?._id?.toString(),
              name: fullOrder.buyer_id?.full_name,
              email: fullOrder.buyer_id?.email,
            },
            store: {
              id: fullOrder.store_id?._id?.toString(),
              name: fullOrder.store_id?.name,
            },
            first_item_image_url:
              fullOrder.order_items?.[0]?.product_id?.image_url || null,
            items_count: fullOrder.order_items?.length || 0,
          };

          emitOrderCreated(createdOrder.store_id.toString(), socketOrderData);
          logger.info("ORDER", "Đã emit socket event order:created", {
            orderId: createdOrder._id.toString(),
            storeId: createdOrder.store_id.toString(),
          });
        }
      } catch (socketError) {
        logger.warn("ORDER", "Không thể emit socket event", {
          error: socketError.message,
          orderId: createdOrder._id.toString(),
        });
        // Không throw error vì socket không quan trọng bằng việc tạo order
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
          select: "image_url image_urls title",
        },
      })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    return orders.map((order) => {
      // Try to get image from order_items
      let firstItemImage = null;
      if (order.order_items && order.order_items.length > 0) {
        const firstItem = order.order_items[0];
        if (firstItem?.product_id) {
          // Try image_url first
          if (firstItem.product_id.image_url) {
            firstItemImage = firstItem.product_id.image_url;
          }
          // Fallback to first image in image_urls array
          else if (
            firstItem.product_id.image_urls &&
            Array.isArray(firstItem.product_id.image_urls) &&
            firstItem.product_id.image_urls.length > 0
          ) {
            firstItemImage = firstItem.product_id.image_urls[0];
          }
        }
      }

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
    // Lấy tất cả đơn hàng của store, loại trừ đơn hàng đã hủy
    const orders = await OrderModel.find({
      store_id,
      status: { $ne: "cancelled" }, // Loại trừ đơn hàng đã hủy
    })
      .populate("buyer_id", "full_name email")
      .populate({
        path: "order_items",
        populate: {
          path: "product_id",
          select: "image_url image_urls title",
        },
      })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true }); // Enable virtuals with lean

    logger.info("ORDER", `Found ${orders.length} orders for store ${store_id}`);

    return orders.map((order) => {
      const buyer = order.buyer_id;

      // Try to get image from order_items
      let firstItemImage = null;
      if (order.order_items && order.order_items.length > 0) {
        const firstItem = order.order_items[0];

        logger.info("ORDER", `Processing order ${order.code}`, {
          hasOrderItems: !!order.order_items,
          orderItemsCount: order.order_items.length,
          firstItemExists: !!firstItem,
          firstItemProductId: firstItem?.product_id?._id?.toString(),
          firstItemImageUrl: firstItem?.product_id?.image_url,
          firstItemImageUrls: firstItem?.product_id?.image_urls,
        });

        if (firstItem?.product_id) {
          // Try image_url first
          if (firstItem.product_id.image_url) {
            firstItemImage = firstItem.product_id.image_url;
            logger.info(
              "ORDER",
              `Using image_url for order ${order.code}: ${firstItemImage}`
            );
          }
          // Fallback to first image in image_urls array
          else if (
            firstItem.product_id.image_urls &&
            Array.isArray(firstItem.product_id.image_urls) &&
            firstItem.product_id.image_urls.length > 0
          ) {
            firstItemImage = firstItem.product_id.image_urls[0];
            logger.info(
              "ORDER",
              `Using image_urls[0] for order ${order.code}: ${firstItemImage}`
            );
          } else {
            logger.warn("ORDER", `No image found for order ${order.code}`);
          }
        } else {
          logger.warn(
            "ORDER",
            `No product_id populated for order ${order.code}`
          );
        }
      } else {
        logger.warn("ORDER", `No order_items for order ${order.code}`);
      }

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
          select: "title image_url image_urls",
        },
      })
      .populate("shipping_address")
      .populate("shipper_id", "full_name email")
      .populate("buyer_id", "full_name email")
      .lean();

    if (!order) return null;

    // Lấy tracking history
    const trackingHistory = await OrderTrackingModel.find({ order_id })
      .sort({ tracked_at: 1 })
      .lean();

    const items = order.order_items.map((item) => {
      // Handle image_urls: use array if available, otherwise fallback to image_url
      let imageUrls = [];
      if (
        item.product_id?.image_urls &&
        Array.isArray(item.product_id.image_urls) &&
        item.product_id.image_urls.length > 0
      ) {
        imageUrls = item.product_id.image_urls;
      } else if (item.product_id?.image_url) {
        imageUrls = [item.product_id.image_url];
      }

      return {
        ...item,
        id: item._id.toString(),
        order_id: item.order_id.toString(),
        product_id:
          item.product_id?._id?.toString() ||
          (item.product_id ? item.product_id.toString() : null),
        product_title: item.product_id?.title || null,
        product_image_url: imageUrls.length > 0 ? imageUrls[0] : null,
        product_image_urls: imageUrls,
        unit_price: item.unit_price || 0,
        qty: item.qty || 0,
        // Backward compatibility
        price: item.unit_price || 0,
        quantity: item.qty || 0,
      };
    });

    const buyer = order.buyer_id;

    return {
      ...order,
      id: order._id.toString(),
      buyer_id:
        buyer?._id?.toString() ||
        buyer?.toString() ||
        order.buyer_id.toString(),
      store_id: order.store_id.toString(),
      buyer_name: buyer?.full_name || null,
      buyer_email: buyer?.email || null,
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

    // Khi chuyển sang "paid": chỉ giảm stock từ reserved_quantity
    // KHÔNG cộng tiền vào ví seller ở đây - sẽ cộng khi đơn hàng được giao thành công (delivered)
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

    // Khi chuyển sang "delivered": cộng tiền vào ví seller (cho cả VNPay và cash)
    // Logic giống thực tế: seller chỉ nhận tiền khi đơn hàng đã được giao thành công
    if (status === "delivered") {
      try {
        const { StoreModel } = await import("../models/store.model.js");
        const { WalletService } = await import("./wallet.service.js");
        const { WalletTransactionModel } = await import(
          "../models/wallet_transaction.model.js"
        );

        const store = await StoreModel.findById(order.store_id).lean();
        if (store && store.owner_id) {
          const sellerId = store.owner_id.toString();

          // Kiểm tra xem đã có transaction cho order này chưa (tránh cộng 2 lần)
          const existingTransaction = await WalletTransactionModel.findOne({
            user_id: sellerId,
            reference_id: order_id.toString(),
            reference_type: "order",
            type: "payment",
            status: "completed",
          }).lean();

          if (!existingTransaction) {
            // Tính tiền seller nhận được
            // Trong thực tế, có thể trừ phí platform (ví dụ: 5-10%)
            const platformFeeRate = parseFloat(
              process.env.PLATFORM_FEE_RATE || "0"
            );
            const platformFee = (order.total * platformFeeRate) / 100;
            const sellerAmount = order.total - platformFee;

            // Kiểm tra nếu là exchange order (total = 0) thì không cộng tiền
            if (order.payment_method !== "exchange" && order.total > 0) {
              await WalletService.add(
                sellerId,
                sellerAmount,
                order_id.toString(),
                "order",
                `Thanh toán đơn hàng ${
                  order.code || order_id
                } (giao hàng thành công): ${sellerAmount.toLocaleString(
                  "vi-VN"
                )} VNĐ${
                  platformFee > 0
                    ? ` (đã trừ phí platform: ${platformFee.toLocaleString(
                        "vi-VN"
                      )} VNĐ)`
                    : ""
                }`
              );

              logger.info(
                "ORDER",
                `Đã cộng tiền vào ví seller khi order chuyển sang delivered`,
                {
                  orderId: order_id,
                  sellerId,
                  sellerAmount,
                  platformFee,
                  orderTotal: order.total,
                  paymentMethod: order.payment_method,
                }
              );
            } else {
              logger.info(
                "ORDER",
                `Bỏ qua cộng tiền cho exchange order (total = 0)`,
                {
                  orderId: order_id,
                  paymentMethod: order.payment_method,
                }
              );
            }
          } else {
            logger.info("ORDER", `Đã cộng tiền vào ví seller trước đó`, {
              orderId: order_id,
              sellerId,
              existingTransactionId: existingTransaction._id.toString(),
            });
          }
        }
      } catch (walletError) {
        // Log lỗi nhưng không fail order update
        logger.error(
          "ORDER",
          `Lỗi khi cộng tiền vào ví seller khi chuyển sang delivered`,
          {
            orderId: order_id,
            error: walletError.message,
          }
        );
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

  /**
   * Hủy đơn hàng - với validation và refund đầy đủ
   */
  async cancelOrder(order_id, currentUser, reason = null) {
    const order = await OrderModel.findById(order_id).lean();
    if (!order) {
      throw new Error("Đơn hàng không tồn tại");
    }

    // Kiểm tra quyền: chỉ buyer hoặc seller/admin có thể hủy
    let canCancel = false;
    if (currentUser.role === ROLES.ADMIN) {
      canCancel = true;
    } else if (currentUser.role === ROLES.SELLER) {
      const { StoreModel } = await import("../models/store.model.js");
      const store = await StoreModel.findById(order.store_id).lean();
      if (store && store.owner_id.toString() === currentUser.id.toString()) {
        canCancel = true;
      }
    } else if (order.buyer_id.toString() === currentUser.id.toString()) {
      canCancel = true;
    }

    if (!canCancel) {
      throw new Error("Bạn không có quyền hủy đơn hàng này");
    }

    // Kiểm tra trạng thái: chỉ có thể hủy khi pending, paid, hoặc payment_failed
    // Không thể hủy nếu đã shipped hoặc delivered
    if (order.status === "cancelled") {
      throw new Error("Đơn hàng đã được hủy trước đó");
    }

    if (order.status === "shipped" || order.status === "delivered") {
      throw new Error(
        `Không thể hủy đơn hàng ở trạng thái "${order.status}". Vui lòng liên hệ hỗ trợ để trả hàng.`
      );
    }

    // Lấy order items để xử lý stock
    const orderItems = await OrderItemModel.find({ order_id }).lean();

    // 1. Trả lại stock (nếu có reserved)
    for (const item of orderItems) {
      const product = await ProductModel.findById(item.product_id).lean();
      if (product && product.reserved_quantity > 0) {
        // Giảm reserved_quantity
        await ProductModel.findByIdAndUpdate(item.product_id, {
          $inc: { reserved_quantity: -item.qty },
        });
      }

      // Nếu đã thanh toán và stock đã bị trừ, trả lại stock_quantity
      if (order.status === "paid") {
        await ProductModel.findByIdAndUpdate(item.product_id, {
          $inc: { stock_quantity: item.qty },
        });
      }
    }

    // 2. Xử lý refund nếu đã thanh toán
    if (order.status === "paid" || order.payment_method === "wallet") {
      const refundAmount = order.total; // Refund toàn bộ số tiền đã thanh toán

      if (order.payment_method === "wallet") {
        // Refund vào ví
        try {
          const { WalletService } = await import("./wallet.service.js");
          await WalletService.add(
            order.buyer_id.toString(),
            refundAmount,
            order._id.toString(),
            "refund",
            `Hoàn tiền đơn hàng ${order.code}`
          );
          logger.info("ORDER", "Đã hoàn tiền vào ví", {
            orderId: order_id,
            amount: refundAmount,
          });
        } catch (error) {
          logger.error("ORDER", "Lỗi hoàn tiền vào ví", {
            orderId: order_id,
            error: error.message,
          });
          // Vẫn tiếp tục hủy order, nhưng ghi log lỗi
        }
      } else if (order.payment_method === "vnpay") {
        // VNPay: Cần tích hợp với VNPay refund API
        // Tạm thời chỉ ghi log
        logger.info("ORDER", "Cần hoàn tiền VNPay", {
          orderId: order_id,
          amount: refundAmount,
        });
        // TODO: Tích hợp VNPay refund API
      }
      // Cash: Không cần refund vì chưa thu tiền
    }

    // 3. Cập nhật order status
    await OrderModel.findByIdAndUpdate(order_id, {
      $set: { status: "cancelled" },
      $unset: { reserved_until: 1 },
    });

    // 4. Tạo tracking record
    await OrderTrackingModel.create({
      order_id,
      status: "cancelled",
      description: reason
        ? `Đơn hàng bị hủy: ${reason}`
        : "Đơn hàng đã được hủy",
      note: reason || null,
    });

    logger.info("ORDER", "Đơn hàng đã được hủy", {
      orderId: order_id,
      cancelledBy: currentUser.id,
      reason,
    });

    // Gửi email notification cho customer
    try {
      const { UserModel } = await import("../models/user.model.js");
      const buyer = await UserModel.findById(order.buyer_id).lean();
      if (buyer && buyer.email) {
        const { sendOrderEmail } = await import("../utils/order_email.js");
        await sendOrderEmail(
          buyer.email,
          {
            code: order.code,
            total: order.total,
            status: "cancelled",
          },
          "order_cancelled",
          { reason }
        );
      }
    } catch (emailError) {
      logger.warn("ORDER", "Không thể gửi email notification khi hủy đơn", {
        error: emailError.message,
        orderId: order_id,
      });
    }

    return await this.detail(order_id);
  },
};
