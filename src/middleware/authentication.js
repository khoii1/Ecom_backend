import jwt from "jsonwebtoken";
import { logger } from "../utils/logger.js";

// Kiểm tra JWT_ACCESS_SECRET khi load module
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_ACCESS_SECRET) {
  logger.error('AUTH', 'JWT_ACCESS_SECRET chưa được cấu hình trong .env');
}

export function authentication(required = true) {
  return (req, res, next) => {
    const headerValue = req.headers.authorization || "";
    const token = headerValue.startsWith("Bearer ")
      ? headerValue.slice(7)
      : null;
    if (!token && required)
      return res.status(401).json({ message: "Không có quyền truy cập" });
    if (!token) return next();
    
    if (!JWT_ACCESS_SECRET) {
      logger.error('AUTH', 'JWT_ACCESS_SECRET không có giá trị khi verify token');
      return res.status(500).json({ message: "Cấu hình hệ thống không hợp lệ" });
    }
    
    try {
      const payload = jwt.verify(token, JWT_ACCESS_SECRET);
      req.currentUser = { id: payload.sub, role: payload.role }; // MongoDB ObjectId as string
      next();
    } catch {
      if (required)
        return res.status(401).json({ message: "Token không hợp lệ" });
      next();
    }
  };
}
