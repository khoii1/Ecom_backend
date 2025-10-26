import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import { UserModel } from "../models/user.model.js";
import { PasswordResetTokenModel } from "../models/password_reset_token.model.js";
import {
  hashPassword,
  comparePassword,
  genCode,
  sha256,
} from "../utils/crypto.js";
import { sendCodeEmail } from "../utils/email.js";

const signAccess = (u) =>
  jwt.sign({ role: u.role }, process.env.JWT_ACCESS_SECRET, {
    subject: u.id.toString(), // Convert integer ID to string for JWT
    expiresIn: process.env.JWT_ACCESS_EXPIRES || "24h", // Tăng thời gian sống lên 24h
  });

export const AuthController = {
  register: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const { fullName, email, password, role } = req.body;
    const exist = await UserModel.findByEmail(email);
    if (exist) return res.status(409).json({ message: "Email đã tồn tại" });
    const password_hash = await hashPassword(password);
    const user = await UserModel.create({
      full_name: fullName,
      email,
      password_hash,
      role: role || "USER",
      status: "pending",
    });
    const code = genCode(6);
    await PasswordResetTokenModel.create({
      user_id: user.id,
      token_hash: sha256(code),
      purpose: "verify_email",
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
      used: false,
    });
    await sendCodeEmail(email, "Xác minh tài khoản", code);
    res.json({
      message: "Đăng ký thành công, vui lòng kiểm tra email để xác minh.",
    });
  },

  verifyEmail: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const { email, code } = req.body;
    const user = await UserModel.findByEmail(email);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    const token = await PasswordResetTokenModel.findLatestByPurpose(
      user.id,
      "verify_email"
    );
    if (!token)
      return res.status(400).json({ message: "Không có mã xác minh" });
    if (token.used)
      return res.status(400).json({ message: "Mã đã được sử dụng" });
    if (new Date(token.expires_at) < new Date())
      return res.status(400).json({ message: "Mã đã hết hạn" });
    if (sha256(code) !== token.token_hash)
      return res.status(400).json({ message: "Mã không đúng" });

    // Mark token as used and activate user
    await PasswordResetTokenModel.markUsed(token.id);
    await UserModel.updateById(user.id, { status: "active" });

    // Auto-create default store for SELLER users
    if (user.role === "SELLER") {
      const { StoreModel } = await import("../models/store.model.js");
      const defaultStoreName = `Cửa hàng của ${user.full_name}`;
      await StoreModel.create({
        owner_id: user.id,
        name: defaultStoreName,
        status: "active",
      });
    }

    res.json({ message: "Xác minh email thành công" });
  },

  login: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    const user = await UserModel.findByEmail(email);
    if (!user)
      return res.status(401).json({ message: "Sai thông tin đăng nhập" });

    const ok = await comparePassword(password, user.password_hash);
    if (!ok)
      return res.status(401).json({ message: "Sai thông tin đăng nhập" });

    if (user.status !== "active")
      return res.status(403).json({ message: "Tài khoản chưa kích hoạt" });

    const access = signAccess(user);
    res.json({
      access_token: access,
      user: {
        id: user.id.toString(),
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  },

  logout: async (req, res) => {
    res.json({ message: "Đã đăng xuất thành công" });
  },

  verifyResetCode: async (req, res) => {
    const { email, code } = req.body;

    // 1️ Kiểm tra user tồn tại
    const user = await UserModel.findByEmail(email);
    if (!user) return res.status(404).json({ message: "Email không tồn tại" });

    // 2️ Tìm token gần nhất cho reset_password
    const token = await PasswordResetTokenModel.findLatestByPurpose(
      user.id,
      "reset_password"
    );
    if (!token)
      return res.status(400).json({ message: "Không có mã xác thực hợp lệ" });

    // 3️⃣ Kiểm tra token đã dùng, hết hạn hoặc sai mã
    if (token.used)
      return res.status(400).json({ message: "Mã đã được sử dụng" });
    if (new Date(token.expires_at) < new Date())
      return res.status(400).json({ message: "Mã đã hết hạn" });
    if (sha256(code) !== token.token_hash)
      return res.status(400).json({ message: "Mã không đúng" });

    // 4️⃣ Nếu hợp lệ
    res.json({ message: "Mã xác thực hợp lệ" });
  },

  forgotPassword: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const { email } = req.body;
    const user = await UserModel.findByEmail(email);
    if (user) {
      const code = genCode(6);
      await PasswordResetTokenModel.create({
        user_id: user.id,
        token_hash: sha256(code),
        purpose: "reset_password",
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        used: false,
      });
      await sendCodeEmail(email, "Đặt lại mật khẩu", code);
    }
    res.json({ message: "Nếu email tồn tại, mã đặt lại đã được gửi" });
  },

  resetPassword: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const { email, code, newPassword } = req.body;
    const user = await UserModel.findByEmail(email);
    if (!user)
      return res.status(400).json({ message: "Thông tin không hợp lệ" });
    const token = await PasswordResetTokenModel.findLatestByPurpose(
      user.id,
      "reset_password"
    );
    if (!token) return res.status(400).json({ message: "Không có mã hợp lệ" });
    if (token.used)
      return res.status(400).json({ message: "Mã đã được sử dụng" });
    if (new Date(token.expires_at) < new Date())
      return res.status(400).json({ message: "Mã đã hết hạn" });
    if (sha256(code) !== token.token_hash)
      return res.status(400).json({ message: "Mã không đúng" });

    await PasswordResetTokenModel.markUsed(token.id);
    const password_hash = await hashPassword(newPassword);
    await UserModel.updateById(user.id, { password_hash });
    res.json({ message: "Đổi mật khẩu thành công" });
  },
};
