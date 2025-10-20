import { validationResult } from "express-validator";

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));
    return res.status(400).json({
      error: "Validation Error",
      message: "Dữ liệu đầu vào không hợp lệ",
      details: errorMessages,
    });
  }
  next();
};
