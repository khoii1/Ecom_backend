import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { UserModel } from '../models/user.model.js';
import { AuthTokenModel } from '../models/auth_token.model.js';
import { PasswordResetTokenModel } from '../models/password_reset_token.model.js';
import { hashPassword, comparePassword, genCode, sha256 } from '../utils/crypto.js';
import { sendCodeEmail } from '../utils/email.js';

const signAccess = (u) => jwt.sign({ role: u.role }, process.env.JWT_ACCESS_SECRET, { subject: u.id, expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' });
const signRefresh = (u) => jwt.sign({}, process.env.JWT_REFRESH_SECRET, { subject: u.id, expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d' });

export const AuthController = {
  register: async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { fullName, email, password, role } = req.body;
    const exist = await UserModel.findByEmail(email);
    if (exist) return res.status(409).json({ message: 'Email đã tồn tại' });
    const password_hash = await hashPassword(password);
    const user = await UserModel.create({ full_name: fullName, email, password_hash, role: role || 'USER', status: 'pending' });
    const code = genCode(6);
    await PasswordResetTokenModel.create({ user_id: user.id, token_hash: sha256(code), purpose: 'verify_email', expires_at: new Date(Date.now()+10*60*1000), used: false });
    await sendCodeEmail(email, 'Xác minh tài khoản', code);
    res.json({ message: 'Đăng ký thành công, vui lòng kiểm tra email để xác minh.' });
  },

  verifyEmail: async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, code } = req.body;
    const user = await UserModel.findByEmail(email);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    const token = await PasswordResetTokenModel.findLatestByPurpose(user.id, 'verify_email');
    if (!token) return res.status(400).json({ message: 'Không có mã xác minh' });
    if (token.used) return res.status(400).json({ message: 'Mã đã được sử dụng' });
    if (new Date(token.expires_at) < new Date()) return res.status(400).json({ message: 'Mã đã hết hạn' });
    if (sha256(code) !== token.token_hash) return res.status(400).json({ message: 'Mã không đúng' });
    await PasswordResetTokenModel.markUsed(token.id);
    await UserModel.updateById(user.id, { status: 'active' });
    res.json({ message: 'Xác minh email thành công' });
  },

  login: async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    const user = await UserModel.findByEmail(email);
    if (!user) return res.status(401).json({ message: 'Sai thông tin đăng nhập' });
    if (user.status !== 'active') return res.status(403).json({ message: 'Tài khoản chưa kích hoạt' });
    const ok = await comparePassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Sai thông tin đăng nhập' });
    const access = signAccess(user);
    const refresh = signRefresh(user);
    await AuthTokenModel.create({ user_id: user.id, refresh_token_hash: sha256(refresh), expires_at: new Date(Date.now()+30*24*3600*1000) });
    res.json({ access_token: access, refresh_token: refresh });
  },

  refresh: async (req, res) => {
    const { refresh_token } = req.body || {};
    if (!refresh_token) return res.status(400).json({ message: 'Thiếu refresh_token' });
    try {
      const payload = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
      const token = await AuthTokenModel.findByUserAndHash(payload.sub, sha256(refresh_token));
      if (!token) return res.status(401).json({ message: 'Refresh token không hợp lệ' });
      const user = await UserModel.findById(payload.sub);
      const access = signAccess(user);
      res.json({ access_token: access });
    } catch {
      res.status(401).json({ message: 'Refresh token không hợp lệ' });
    }
  },

  logout: async (req, res) => {
    const { refresh_token } = req.body || {};
    if (!refresh_token) return res.status(400).json({ message: 'Thiếu refresh_token' });
    await (await import('../models/auth_token.model.js')).AuthTokenModel.deleteByHash(sha256(refresh_token));
    res.json({ message: 'Đã đăng xuất' });
  },

  forgotPassword: async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email } = req.body;
    const user = await UserModel.findByEmail(email);
    if (user) {
      const code = genCode(6);
      await PasswordResetTokenModel.create({ user_id: user.id, token_hash: sha256(code), purpose: 'reset_password', expires_at: new Date(Date.now()+10*60*1000), used: false });
      await sendCodeEmail(email, 'Đặt lại mật khẩu', code);
    }
    res.json({ message: 'Nếu email tồn tại, mã đặt lại đã được gửi' });
  },

  resetPassword: async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, code, newPassword } = req.body;
    const user = await UserModel.findByEmail(email);
    if (!user) return res.status(400).json({ message: 'Thông tin không hợp lệ' });
    const token = await PasswordResetTokenModel.findLatestByPurpose(user.id, 'reset_password');
    if (!token) return res.status(400).json({ message: 'Không có mã hợp lệ' });
    if (token.used) return res.status(400).json({ message: 'Mã đã được sử dụng' });
    if (new Date(token.expires_at) < new Date()) return res.status(400).json({ message: 'Mã đã hết hạn' });
    if (sha256(code) !== token.token_hash) return res.status(400).json({ message: 'Mã không đúng' });
    await PasswordResetTokenModel.markUsed(token.id);
    const password_hash = await hashPassword(newPassword);
    await UserModel.updateById(user.id, { password_hash });
    await (await import('../models/auth_token.model.js')).AuthTokenModel.deleteByUser(user.id);
    res.json({ message: 'Đổi mật khẩu thành công' });
  },
};
