import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import { UserModel } from "../models/user.model.js";
import { UserService } from "../services/user.service.js";
import { PasswordResetTokenModel } from "../models/password_reset_token.model.js";
import {
  hashPassword,
  comparePassword,
  genCode,
  sha256,
} from "../utils/crypto.js";
import { sendCodeEmail } from "../utils/email.js";
import { logger } from "../utils/logger.js";

// Kiểm tra JWT_ACCESS_SECRET khi khởi động
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_ACCESS_SECRET) {
  logger.error('AUTH', 'JWT_ACCESS_SECRET chưa được cấu hình trong .env');
  logger.error('AUTH', 'Vui lòng thêm JWT_ACCESS_SECRET vào file .env');
}

const signAccess = (u) => {
  if (!JWT_ACCESS_SECRET) {
    logger.error('AUTH', 'JWT_ACCESS_SECRET không có giá trị');
    throw new Error('JWT_ACCESS_SECRET chưa được cấu hình. Vui lòng kiểm tra file .env');
  }
  
  return jwt.sign({ role: u.role }, JWT_ACCESS_SECRET, {
    subject: u._id.toString(), // MongoDB ObjectId to string for JWT
    expiresIn: process.env.JWT_ACCESS_EXPIRES || "24h",
  });
};

export const AuthController = {
  register: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('AUTH', 'Đăng ký thất bại - validation error', { errors: errors.array() });
        return res.status(400).json({ errors: errors.array() });
      }
      const { fullName, email, password, role } = req.body;
      // Email đã được normalizeEmail() trong validation, nhưng đảm bảo lowercase
      const normalizedEmail = email.toLowerCase().trim();
      logger.info('AUTH', `Yêu cầu đăng ký tài khoản mới`, { email: normalizedEmail, role: role || 'USER' });
      
      const exist = await UserModel.findByEmail(normalizedEmail);
      if (exist) {
        logger.warn('AUTH', 'Đăng ký thất bại - email đã tồn tại', { email: normalizedEmail });
        return res.status(409).json({ message: "Email đã tồn tại" });
      }
      
      const password_hash = await hashPassword(password);
      const user = await UserModel.create({
        full_name: fullName,
        email: normalizedEmail,
        password_hash,
        role: role || "USER",
        status: "pending",
      });
      logger.info('AUTH', `Tạo user mới thành công`, { userId: user._id.toString(), email, role: user.role });
      
      const code = genCode(6);
      const token = await PasswordResetTokenModel.create({
        user_id: user._id,
        token_hash: sha256(code),
        purpose: "verify_email",
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        used: false,
      });
      
      try {
        await sendCodeEmail(normalizedEmail, "Xác minh tài khoản", code);
        logger.info('AUTH', `Đã gửi email xác minh`, { email: normalizedEmail });
      } catch (emailError) {
        logger.error('AUTH', `Lỗi gửi email xác minh`, { email: normalizedEmail, error: emailError.message });
        // Bắt buộc phải gửi được email mới cho phép đăng ký
        // Rollback: Xóa token và user vì email không gửi được
        try {
          await PasswordResetTokenModel.deleteOne({ _id: token._id });
          logger.info('AUTH', `Đã xóa token do email không gửi được`, { tokenId: token._id.toString() });
        } catch (deleteTokenError) {
          logger.error('AUTH', `Lỗi khi xóa token trong rollback`, { 
            tokenId: token._id.toString(), 
            error: deleteTokenError.message 
          });
        }
        
        try {
          await UserModel.deleteOne({ _id: user._id });
          logger.info('AUTH', `Đã xóa user do email không gửi được`, { userId: user._id.toString() });
        } catch (deleteUserError) {
          logger.error('AUTH', `Lỗi khi xóa user trong rollback`, { 
            userId: user._id.toString(), 
            error: deleteUserError.message 
          });
        }
        
        logger.warn('AUTH', `Đã rollback: xóa user và token do email không gửi được`, { 
          email: normalizedEmail, 
          userId: user._id.toString() 
        });
        
        // Trả về lỗi để frontend biết đăng ký thất bại
        return res.status(503).json({
          message: "Không thể gửi email xác minh. Vui lòng thử lại sau hoặc liên hệ admin.",
          error: "Email service unavailable",
          details: emailError.message,
        });
      }
      
      res.json({
        message: "Đăng ký thành công, vui lòng kiểm tra email để xác minh.",
      });
    } catch (error) {
      logger.error('AUTH', 'Lỗi khi đăng ký', { error: error.message, stack: error.stack });
      
      // Xử lý lỗi duplicate email từ MongoDB
      if (error.code === 11000 || error.code === 11001) {
        return res.status(409).json({ 
          message: "Email đã tồn tại",
          error: "Conflict"
        });
      }
      
      // Xử lý lỗi validation từ Mongoose
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors || {}).map(e => e.message);
        return res.status(400).json({
          message: "Dữ liệu không hợp lệ",
          details: messages,
        });
      }
      
      // Lỗi khác - để errorHandler xử lý
      throw error;
    }
  },

  verifyEmail: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('AUTH', 'Xác minh email thất bại - validation error', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, code } = req.body;
    logger.info('AUTH', `Yêu cầu xác minh email`, { email });
    
    const user = await UserModel.findByEmail(email);
    if (!user) {
      logger.warn('AUTH', 'Xác minh email thất bại - không tìm thấy user', { email });
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    
    const token = await PasswordResetTokenModel.findLatestByPurpose(
      user._id,
      "verify_email"
    );
    if (!token) {
      logger.warn('AUTH', 'Xác minh email thất bại - không có mã', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Không có mã xác minh" });
    }
    if (token.used) {
      logger.warn('AUTH', 'Xác minh email thất bại - mã đã sử dụng', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Mã đã được sử dụng" });
    }
    if (new Date(token.expires_at) < new Date()) {
      logger.warn('AUTH', 'Xác minh email thất bại - mã hết hạn', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Mã đã hết hạn" });
    }
    if (sha256(code) !== token.token_hash) {
      logger.warn('AUTH', 'Xác minh email thất bại - mã không đúng', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Mã không đúng" });
    }

    // Mark token as used and activate user
    await PasswordResetTokenModel.markUsed(token._id);
    await UserService.update(null, user._id, { status: "active" });
    logger.info('AUTH', `Kích hoạt tài khoản thành công`, { email, userId: user._id.toString() });

    // Auto-create default store for SELLER users
    if (user.role === "SELLER") {
      const { StoreModel } = await import("../models/store.model.js");
      const defaultStoreName = `Cửa hàng của ${user.full_name}`;
      await StoreModel.create({
        owner_id: user._id,
        name: defaultStoreName,
        status: "active",
      });
      logger.info('AUTH', `Tạo store mặc định cho SELLER`, { email, userId: user._id.toString(), storeName: defaultStoreName });
    }

    res.json({ message: "Xác minh email thành công" });
  },

  login: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('AUTH', 'Đăng nhập thất bại - validation error', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    logger.info('AUTH', `Yêu cầu đăng nhập`, { email });
    
    const user = await UserModel.findByEmail(email);
    if (!user) {
      logger.warn('AUTH', 'Đăng nhập thất bại - email không tồn tại', { email });
      return res.status(401).json({ message: "Sai thông tin đăng nhập" });
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      logger.warn('AUTH', 'Đăng nhập thất bại - mật khẩu sai', { email, userId: user._id.toString() });
      return res.status(401).json({ message: "Sai thông tin đăng nhập" });
    }

    if (user.status !== "active") {
      logger.warn('AUTH', 'Đăng nhập thất bại - tài khoản chưa kích hoạt', { email, userId: user._id.toString(), status: user.status });
      return res.status(403).json({ message: "Tài khoản chưa kích hoạt" });
    }

    const access = signAccess(user);
    logger.info('AUTH', `Đăng nhập thành công`, { email, userId: user._id.toString(), role: user.role });
    
    res.json({
      access_token: access,
      user: {
        id: user._id.toString(),
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        status: user.status,
      },
    });
  },

  logout: async (req, res) => {
    const userId = req.currentUser?.id || 'unknown';
    logger.info('AUTH', `Đăng xuất`, { userId });
    res.json({ message: "Đã đăng xuất thành công" });
  },

  verifyResetCode: async (req, res) => {
    const { email, code } = req.body;
    logger.info('AUTH', `Yêu cầu xác thực mã reset password`, { email });

    // 1️ Kiểm tra user tồn tại
    const user = await UserModel.findByEmail(email);
    if (!user) {
      logger.warn('AUTH', 'Xác thực mã reset thất bại - email không tồn tại', { email });
      return res.status(404).json({ message: "Email không tồn tại" });
    }

    // 2️ Tìm token gần nhất cho reset_password
    const token = await PasswordResetTokenModel.findLatestByPurpose(
      user._id,
      "reset_password"
    );
    if (!token) {
      logger.warn('AUTH', 'Xác thực mã reset thất bại - không có mã', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Không có mã xác thực hợp lệ" });
    }

    // 3️⃣ Kiểm tra token đã dùng, hết hạn hoặc sai mã
    if (token.used) {
      logger.warn('AUTH', 'Xác thực mã reset thất bại - mã đã sử dụng', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Mã đã được sử dụng" });
    }
    if (new Date(token.expires_at) < new Date()) {
      logger.warn('AUTH', 'Xác thực mã reset thất bại - mã hết hạn', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Mã đã hết hạn" });
    }
    if (sha256(code) !== token.token_hash) {
      logger.warn('AUTH', 'Xác thực mã reset thất bại - mã không đúng', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Mã không đúng" });
    }

    // 4️⃣ Nếu hợp lệ
    logger.info('AUTH', `Xác thực mã reset thành công`, { email, userId: user._id.toString() });
    res.json({ message: "Mã xác thực hợp lệ" });
  },

  forgotPassword: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('AUTH', 'Quên mật khẩu thất bại - validation error', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }
    const { email } = req.body;
    logger.info('AUTH', `Yêu cầu quên mật khẩu`, { email });
    
    const user = await UserModel.findByEmail(email);
    if (user) {
      try {
        const code = genCode(6);
        await PasswordResetTokenModel.create({
          user_id: user._id,
          token_hash: sha256(code),
          purpose: "reset_password",
          expires_at: new Date(Date.now() + 10 * 60 * 1000),
          used: false,
        });
        await sendCodeEmail(email, "Đặt lại mật khẩu", code);
        logger.info('AUTH', `Đã gửi email đặt lại mật khẩu`, { email, userId: user._id.toString() });
      } catch (emailError) {
        logger.error('AUTH', `Lỗi gửi email đặt lại mật khẩu`, { email, error: emailError.message });
        return res.status(500).json({ message: emailError.message || "Không thể gửi email. Vui lòng thử lại sau." });
      }
    } else {
      logger.warn('AUTH', 'Quên mật khẩu - email không tồn tại (không thông báo cho client)', { email });
    }
    res.json({ message: "Nếu email tồn tại, mã đặt lại đã được gửi" });
  },

  resetPassword: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('AUTH', 'Reset mật khẩu thất bại - validation error', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, code, newPassword } = req.body;
    logger.info('AUTH', `Yêu cầu đặt lại mật khẩu`, { email });
    
    const user = await UserModel.findByEmail(email);
    if (!user) {
      logger.warn('AUTH', 'Reset mật khẩu thất bại - email không tồn tại', { email });
      return res.status(400).json({ message: "Thông tin không hợp lệ" });
    }
    
    const token = await PasswordResetTokenModel.findLatestByPurpose(
      user._id,
      "reset_password"
    );
    if (!token) {
      logger.warn('AUTH', 'Reset mật khẩu thất bại - không có mã', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Không có mã hợp lệ" });
    }
    if (token.used) {
      logger.warn('AUTH', 'Reset mật khẩu thất bại - mã đã sử dụng', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Mã đã được sử dụng" });
    }
    if (new Date(token.expires_at) < new Date()) {
      logger.warn('AUTH', 'Reset mật khẩu thất bại - mã hết hạn', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Mã đã hết hạn" });
    }
    if (sha256(code) !== token.token_hash) {
      logger.warn('AUTH', 'Reset mật khẩu thất bại - mã không đúng', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Mã không đúng" });
    }

    await PasswordResetTokenModel.markUsed(token._id);
    const password_hash = await hashPassword(newPassword);
    await UserService.update(null, user._id, { password_hash });
    logger.info('AUTH', `Đặt lại mật khẩu thành công`, { email, userId: user._id.toString() });
    res.json({ message: "Đổi mật khẩu thành công" });
  },

  resendVerificationEmail: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('AUTH', 'Resend verification email thất bại - validation error', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }
    const { email } = req.body;
    logger.info('AUTH', `Yêu cầu gửi lại email xác minh`, { email });
    
    const user = await UserModel.findByEmail(email);
    if (!user) {
      logger.warn('AUTH', 'Resend verification email thất bại - email không tồn tại', { email });
      return res.status(404).json({ message: "Email không tồn tại" });
    }
    
    if (user.status === "active") {
      logger.warn('AUTH', 'Resend verification email thất bại - tài khoản đã kích hoạt', { email, userId: user._id.toString() });
      return res.status(400).json({ message: "Tài khoản đã được kích hoạt" });
    }
    
    // Xóa tất cả token verify_email cũ (chưa dùng) của user này
    await PasswordResetTokenModel.deleteMany({
      user_id: user._id,
      purpose: "verify_email",
      used: false,
    });
    logger.info('AUTH', `Đã xóa token verify_email cũ`, { email, userId: user._id.toString() });
    
    // Tạo mã mới
    const code = genCode(6);
    await PasswordResetTokenModel.create({
      user_id: user._id,
      token_hash: sha256(code),
      purpose: "verify_email",
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
      used: false,
    });
    
    try {
      await sendCodeEmail(email, "Xác minh tài khoản", code);
      logger.info('AUTH', `Đã gửi lại email xác minh`, { email, userId: user._id.toString() });
      res.json({ message: "Đã gửi lại email xác minh. Vui lòng kiểm tra email." });
    } catch (emailError) {
      logger.error('AUTH', `Lỗi gửi lại email xác minh`, { email, error: emailError.message });
      // Xóa token vừa tạo nếu email không gửi được
      await PasswordResetTokenModel.deleteMany({
        user_id: user._id,
        purpose: "verify_email",
        used: false,
      });
      return res.status(503).json({
        message: "Không thể gửi email xác minh. Vui lòng thử lại sau hoặc liên hệ admin.",
        error: "Email service unavailable",
        details: emailError.message,
      });
    }
  },
};
