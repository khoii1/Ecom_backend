import { OrderModel } from "../models/order.model.js";
import { OrderItemModel } from "../models/order_item.model.js";
import { ProductModel } from "../models/product.model.js";
import { logger } from "../utils/logger.js";

/**
 * Xử lý reservation cho các order quá thời hạn (10 phút)
 * Chạy mỗi 1 phút để check
 * 
 * Logic:
 * - VNPay: Tự động hủy order nếu pending quá 10 phút (chưa thanh toán)
 * - Cash: Chỉ trả lại reserved stock, KHÔNG hủy order. Order vẫn ở pending để seller có thể xác nhận sau
 */
export async function cancelExpiredReservations() {
  try {
    const now = new Date();
    
    // Tìm các order pending có reserved_until đã hết hạn
    const expiredOrders = await OrderModel.find({
      status: "pending",
      reserved_until: { $lt: now }
    }).lean();
    
    if (expiredOrders.length === 0) {
      return;
    }
    
    logger.info('RESERVATION', `Tìm thấy ${expiredOrders.length} đơn hàng quá hạn`, {
      orderIds: expiredOrders.map(o => o._id.toString())
    });
    
    for (const order of expiredOrders) {
      try {
        // Lấy order items
        const orderItems = await OrderItemModel.find({ 
          order_id: order._id 
        }).lean();
        
        // Trả lại reserved stock (cho cả cash và vnpay)
        for (const item of orderItems) {
          await ProductModel.findByIdAndUpdate(item.product_id, {
            $inc: { reserved_quantity: -item.qty }
          });
        }
        
        // Xử lý khác nhau theo payment_method
        if (order.payment_method === "vnpay") {
          // VNPay: Tự động hủy order nếu pending quá 10 phút (chưa thanh toán)
          await OrderModel.findByIdAndUpdate(order._id, {
            $set: { status: "cancelled" },
            $unset: { reserved_until: 1 }
          });
          
          logger.info('RESERVATION', `Đã hủy order VNPay quá hạn`, {
            orderId: order._id.toString(),
            itemsCount: orderItems.length
          });
        } else if (order.payment_method === "cash") {
          // Cash: Chỉ trả lại stock, KHÔNG hủy order
          // Order vẫn ở pending để seller có thể xác nhận sau
          await OrderModel.findByIdAndUpdate(order._id, {
            $unset: { reserved_until: 1 }
          });
          
          // Tạo thông báo cho seller để nhắc nhở xác nhận đơn hàng
          const { NotificationModel } = await import("../models/notification.model.js");
          const { StoreModel } = await import("../models/store.model.js");
          
          const store = await StoreModel.findById(order.store_id)
            .populate("owner_id")
            .lean();
          
          if (store?.owner_id) {
            await NotificationModel.create({
              user_id: store.owner_id._id,
              type: "order",
              title: "Đơn hàng đã quá 10 phút chưa xác nhận",
              message: `Đơn hàng ${order.code} đã quá 10 phút. Stock đã được giải phóng. Vui lòng xác nhận đơn hàng nếu khách hàng vẫn muốn mua.`,
              order_id: order._id.toString(),
              data: {
                order_code: order.code,
                order_id: order._id.toString(),
              },
            });
          }
          
          logger.info('RESERVATION', `Đã trả lại stock cho order Cash quá hạn (không hủy order)`, {
            orderId: order._id.toString(),
            itemsCount: orderItems.length
          });
        }
      } catch (error) {
        logger.error('RESERVATION', `Lỗi khi xử lý reservation`, {
          orderId: order._id.toString(),
          error: error.message
        });
      }
    }
  } catch (error) {
    logger.error('RESERVATION', `Lỗi khi check expired reservations`, {
      error: error.message
    });
  }
}

/**
 * Khởi động scheduler để check expired reservations
 */
export function startReservationScheduler() {
  // Chạy ngay lần đầu
  cancelExpiredReservations();
  
  // Sau đó chạy mỗi 1 phút
  setInterval(() => {
    cancelExpiredReservations();
  }, 60 * 1000); // 60 giây = 1 phút
  
  logger.info('RESERVATION', 'Đã khởi động scheduler xử lý reservation (chạy mỗi 1 phút)');
  logger.info('RESERVATION', 'Logic: VNPay tự động hủy, Cash chỉ trả lại stock');
}

