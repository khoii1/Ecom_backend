import { sendCodeEmail } from "./email.js";
import sg from "@sendgrid/mail";
import { logger } from "./logger.js";

// Kiểm tra SendGrid API Key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM;
const fromName = process.env.SENDGRID_FROM_NAME || "Ecommerce Platform";

if (SENDGRID_API_KEY) {
  sg.setApiKey(SENDGRID_API_KEY);
}

/**
 * Gửi email thông báo về đơn hàng
 */
export async function sendOrderEmail(to, order, eventType, additionalData = {}) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const skipEmail = process.env.SKIP_EMAIL === 'true' || process.env.SKIP_EMAIL === '1';

  if (!SENDGRID_API_KEY || !fromEmail) {
    logger.warn('ORDER_EMAIL', 'SendGrid chưa được cấu hình, bỏ qua gửi email', {
      to,
      orderCode: order.code,
      eventType,
    });
    return;
  }

  if (isDevelopment && skipEmail) {
    logger.info('ORDER_EMAIL', `DEVELOPMENT MODE: Bỏ qua gửi email`, {
      to,
      orderCode: order.code,
      eventType,
    });
    return;
  }

  const emailTemplates = {
    order_created: {
      subject: `Đơn hàng ${order.code} đã được tạo thành công`,
      getHtml: (order) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #5D4037;">Cảm ơn bạn đã đặt hàng!</h2>
          <p>Đơn hàng <strong>${order.code}</strong> của bạn đã được tạo thành công.</p>
          <div style="background: #F5F5DC; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Tổng tiền:</strong> ${order.total?.toLocaleString('vi-VN')} đ</p>
            <p><strong>Phương thức thanh toán:</strong> ${getPaymentMethodName(order.payment_method)}</p>
            <p><strong>Trạng thái:</strong> ${getStatusName(order.status)}</p>
          </div>
          <p>Chúng tôi sẽ xử lý đơn hàng của bạn trong thời gian sớm nhất.</p>
        </div>
      `,
    },
    order_paid: {
      subject: `Đơn hàng ${order.code} đã được thanh toán`,
      getHtml: (order) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #5D4037;">Thanh toán thành công!</h2>
          <p>Đơn hàng <strong>${order.code}</strong> của bạn đã được thanh toán thành công.</p>
          <div style="background: #F5F5DC; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Số tiền đã thanh toán:</strong> ${order.total?.toLocaleString('vi-VN')} đ</p>
            <p><strong>Trạng thái:</strong> ${getStatusName(order.status)}</p>
          </div>
          <p>Đơn hàng đang được chuẩn bị và sẽ được giao đến bạn sớm nhất có thể.</p>
        </div>
      `,
    },
    order_shipped: {
      subject: `Đơn hàng ${order.code} đã được vận chuyển`,
      getHtml: (order) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #5D4037;">Đơn hàng đang trên đường giao đến bạn!</h2>
          <p>Đơn hàng <strong>${order.code}</strong> đã được vận chuyển.</p>
          ${order.tracking_number ? `<p><strong>Mã vận đơn:</strong> ${order.tracking_number}</p>` : ''}
          <div style="background: #F5F5DC; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Trạng thái:</strong> ${getStatusName(order.status)}</p>
          </div>
          <p>Bạn sẽ nhận được thông báo khi đơn hàng đã được giao.</p>
        </div>
      `,
    },
    order_delivered: {
      subject: `Đơn hàng ${order.code} đã được giao`,
      getHtml: (order) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #5D4037;">Đơn hàng đã được giao!</h2>
          <p>Đơn hàng <strong>${order.code}</strong> đã được giao đến bạn.</p>
          <div style="background: #F5F5DC; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Trạng thái:</strong> ${getStatusName(order.status)}</p>
          </div>
          <p>Vui lòng xác nhận đã nhận hàng trong ứng dụng hoặc trên website.</p>
          <p>Cảm ơn bạn đã tin tưởng và mua sắm tại cửa hàng của chúng tôi!</p>
        </div>
      `,
    },
    order_cancelled: {
      subject: `Đơn hàng ${order.code} đã được hủy`,
      getHtml: (order, reason) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #5D4037;">Đơn hàng đã được hủy</h2>
          <p>Đơn hàng <strong>${order.code}</strong> đã được hủy.</p>
          ${reason ? `<p><strong>Lý do:</strong> ${reason}</p>` : ''}
          <div style="background: #F5F5DC; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Trạng thái:</strong> ${getStatusName(order.status)}</p>
            ${order.total > 0 ? `<p><strong>Số tiền đã hoàn:</strong> ${order.total?.toLocaleString('vi-VN')} đ</p>` : ''}
          </div>
          <p>Nếu bạn đã thanh toán, số tiền sẽ được hoàn lại trong vòng 3-5 ngày làm việc.</p>
        </div>
      `,
    },
  };

  const template = emailTemplates[eventType];
  if (!template) {
    logger.warn('ORDER_EMAIL', `Không tìm thấy template cho event type: ${eventType}`);
    return;
  }

  try {
    await sg.send({
      to,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: template.subject,
      html: template.getHtml(order, additionalData.reason),
    });

    logger.info('ORDER_EMAIL', `Gửi email thành công`, {
      to,
      orderCode: order.code,
      eventType,
    });
  } catch (error) {
    logger.error('ORDER_EMAIL', `Gửi email thất bại`, {
      to,
      orderCode: order.code,
      eventType,
      error: error.message,
    });
    // Không throw error để không ảnh hưởng đến flow chính
  }
}

function getPaymentMethodName(method) {
  const methods = {
    cash: 'Tiền mặt',
    vnpay: 'VNPay',
    wallet: 'Ví điện tử',
  };
  return methods[method] || method;
}

function getStatusName(status) {
  const statuses = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    payment_failed: 'Thanh toán thất bại',
    processing: 'Đang xử lý',
    shipped: 'Đang vận chuyển',
    delivered: 'Đã giao hàng',
    cancelled: 'Đã hủy',
  };
  return statuses[status] || status;
}

