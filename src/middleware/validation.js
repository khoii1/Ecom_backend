import { validationResult } from "express-validator";
import { logger } from "../utils/logger.js";

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));
    
    logger.warn('VALIDATION', `${req.method} ${req.originalUrl || req.url} → Validation failed`, {
      errors: errorMessages,
    });
    
    return res.status(400).json({
      error: "Validation Error",
      message: "Dữ liệu đầu vào không hợp lệ",
      details: errorMessages,
    });
  }
  next();
};
