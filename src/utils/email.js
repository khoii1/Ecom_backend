import sg from "@sendgrid/mail";
import dotenv from "dotenv";
import { logger } from "./logger.js";

dotenv.config();

// Kiểm tra SendGrid API Key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (!SENDGRID_API_KEY) {
  logger.warn('EMAIL', 'SENDGRID_API_KEY chưa được cấu hình trong .env');
} else {
  sg.setApiKey(SENDGRID_API_KEY);
  logger.info('EMAIL', 'SendGrid đã được cấu hình');
}

export async function sendCodeEmail(to, subject, code) {
  // Chế độ development: Log OTP ra console thay vì gửi email
  const isDevelopment = process.env.NODE_ENV === 'development';
  const skipEmail = process.env.SKIP_EMAIL === 'true' || process.env.SKIP_EMAIL === '1';
  
  if (isDevelopment && skipEmail) {
    logger.warn('EMAIL', `DEVELOPMENT MODE: Bỏ qua gửi email thật`, { 
      to, 
      subject,
      note: 'Xem OTP trong log bên dưới'
    });
    logger.info('EMAIL', `═══════════════════════════════════════`);
    logger.info('EMAIL', `EMAIL OTP (DEVELOPMENT MODE)`);
    logger.info('EMAIL', `To: ${to}`);
    logger.info('EMAIL', `Subject: ${subject}`);
    logger.info('EMAIL', `Mã OTP: ${code}`);
    logger.info('EMAIL', `═══════════════════════════════════════`);
    // Trả về thành công trong development mode
    return;
  }

  // Kiểm tra cấu hình trước khi gửi
  if (!SENDGRID_API_KEY) {
    logger.error('EMAIL', 'Không thể gửi email - SENDGRID_API_KEY chưa cấu hình');
    throw new Error('Email service chưa được cấu hình. Vui lòng liên hệ admin.');
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM;
  if (!fromEmail) {
    logger.error('EMAIL', 'Không thể gửi email - SENDGRID_FROM_EMAIL chưa cấu hình');
    throw new Error('Email sender chưa được cấu hình. Vui lòng liên hệ admin.');
  }

  try {
    logger.info('EMAIL', `Đang gửi email tới ${to}`, { subject });
    
    await sg.send({
      to,
      from: {
        email: fromEmail,
        name: process.env.SENDGRID_FROM_NAME || "Ecommerce Platform",
      },
      subject,
      text: `Mã của bạn: ${code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #5D4037;">${subject}</h2>
          <p>Mã xác thực của bạn là:</p>
          <div style="background: #F5F5DC; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #5D4037;">${code}</span>
          </div>
          <p style="color: #666;">Mã này có hiệu lực trong 10 phút.</p>
          <p style="color: #999; font-size: 12px;">Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
        </div>
      `,
    });
    
    logger.info('EMAIL', `Gửi email thành công tới ${to}`);
  } catch (error) {
    // Log chi tiết lỗi từ SendGrid - log toàn bộ error object
    const errorDetails = {
      error: error.message,
      code: error.code,
      name: error.name,
      statusCode: error.response?.statusCode,
      status: error.response?.status,
      responseBody: error.response?.body,
      responseHeaders: error.response?.headers,
    };
    
    // Log đầy đủ thông tin lỗi
    logger.error('EMAIL', `Gửi email thất bại tới ${to}`, errorDetails);
    
    // Log thêm thông tin chi tiết (chỉ trong development)
    if (isDevelopment) {
      logger.error('EMAIL', `Error Stack:`, { stack: error.stack });
      if (error.response) {
        logger.error('EMAIL', `Response Status: ${error.response.statusCode}`, {
          status: error.response.status,
          statusText: error.response.statusText,
        });
      }
    }
    
    // Kiểm tra các lỗi phổ biến từ SendGrid
    let userMessage = 'Không thể gửi email. Vui lòng thử lại sau.';
    
    // Kiểm tra response body
    if (error.response?.body) {
      const body = error.response.body;
      
      // Nếu có errors array
      if (body.errors && Array.isArray(body.errors) && body.errors.length > 0) {
        const sendGridError = body.errors[0];
        logger.error('EMAIL', `SendGrid Error Details:`, { 
          message: sendGridError.message,
          field: sendGridError.field,
          help: sendGridError.help,
        });
        
        // Xử lý các lỗi cụ thể
        if (sendGridError.message && (
          sendGridError.message.includes('Maximum credits exceeded') || 
          sendGridError.message.includes('credits')
        )) {
          userMessage = 'Dịch vụ email tạm thời không khả dụng (hết credits). Vui lòng liên hệ admin.';
        } else if (sendGridError.message && (
          sendGridError.message.includes('Invalid') || 
          sendGridError.message.includes('unauthorized') ||
          sendGridError.message.includes('Forbidden')
        )) {
          userMessage = 'Cấu hình email không hợp lệ hoặc API key không đúng. Vui lòng kiểm tra lại.';
        } else if (sendGridError.message) {
          userMessage = `Lỗi SendGrid: ${sendGridError.message}`;
        }
      } else {
        // Nếu không có errors array, log toàn bộ body
        logger.error('EMAIL', `SendGrid Response Body:`, body);
      }
    }
    
    // Kiểm tra status code
    if (error.response?.statusCode === 401 || error.response?.statusCode === 403) {
      userMessage = 'API key SendGrid không hợp lệ hoặc không có quyền. Vui lòng kiểm tra lại.';
    } else if (error.response?.statusCode === 400) {
      userMessage = 'Dữ liệu email không hợp lệ. Vui lòng kiểm tra email người gửi và người nhận.';
    }
    
    // Trong development, vẫn log OTP ra console để test
    if (isDevelopment) {
      logger.warn('EMAIL', `DEVELOPMENT MODE: Log OTP để test`, { 
        to, 
        code,
        note: 'Email thật không gửi được, dùng OTP này để test'
      });
      logger.info('EMAIL', `═══════════════════════════════════════`);
      logger.info('EMAIL', `EMAIL OTP (FALLBACK - EMAIL FAILED)`);
      logger.info('EMAIL', `To: ${to}`);
      logger.info('EMAIL', `Subject: ${subject}`);
      logger.info('EMAIL', `Mã OTP: ${code}`);
      logger.info('EMAIL', `═══════════════════════════════════════`);
    }
    
    throw new Error(userMessage);
  }
}
