import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  logger.error('ERROR', `${req.method} ${req.originalUrl || req.url} → ${err.message}`, {
    errorCode: err.code,
    errorName: err.name,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Validation errors from express-validator
  if (err.type === "validation") {
    return res.status(400).json({
      error: "Validation Error",
      message: "Dữ liệu đầu vào không hợp lệ",
      details: err.errors,
    });
  }

  // Database connection errors
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    return res.status(503).json({
      error: "Service Unavailable",
      message: "Không thể kết nối với cơ sở dữ liệu",
    });
  }

  // MongoDB errors
  if (err.code === 11000 || err.code === 11001) {
    // Duplicate key error (unique constraint violation)
    return res.status(409).json({
      error: "Conflict",
      message: "Dữ liệu đã tồn tại",
    });
  }

  if (err.name === "ValidationError") {
    // Mongoose validation error
    const messages = Object.values(err.errors || {}).map(e => e.message);
    return res.status(400).json({
      error: "Bad Request",
      message: "Dữ liệu không hợp lệ",
      details: messages,
    });
  }

  if (err.name === "CastError") {
    // Invalid ObjectId or type casting error
    return res.status(400).json({
      error: "Bad Request",
      message: "ID hoặc dữ liệu không hợp lệ",
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Token không hợp lệ",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Token đã hết hạn",
    });
  }

  // Custom application errors
  if (err.message === "FORBIDDEN") {
    return res.status(403).json({
      error: "Forbidden",
      message: "Không có quyền truy cập",
    });
  }

  if (err.message === "STORE_NOT_FOUND") {
    return res.status(404).json({
      error: "Not Found",
      message: "Cửa hàng không tồn tại",
    });
  }

  // SendGrid/Email errors
  if (err.code >= 400 && err.code < 500 && err.response) {
    return res.status(500).json({
      error: "Email Service Error",
      message: "Không thể gửi email, vui lòng thử lại sau",
    });
  }

  // Default error response
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: isDevelopment ? err.message : "Đã xảy ra lỗi hệ thống",
    ...(isDevelopment && { stack: err.stack }),
  });
}

// 404 handler for routes that don't exist
export function notFoundHandler(req, res) {
  logger.warn('HTTP', `404 - Đường dẫn không tồn tại: ${req.path}`, {
    method: req.method,
    path: req.path,
  });
  res.status(404).json({
    error: "Not Found",
    message: "Đường dẫn không tồn tại",
    path: req.path,
  });
}
