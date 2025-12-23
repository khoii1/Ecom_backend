import { UserService } from "../services/user.service.js";
import { UserModel } from "../models/user.model.js";
import { comparePassword, hashPassword } from "../utils/crypto.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";

export const UserController = {
  list: handle(async (req, res) => {
    const { role } = req.query;
    const users = await UserService.list(role);
    logger.info('USER', `Trả về ${users.length} users`, { role });
    res.json(users);
  }),

  detail: handle(async (req, res) => {
    const userId = req.params.userId;
    logger.debug('USER', 'Lấy chi tiết user', { userId });
    const user = await UserService.detail(userId);
    if (!user) {
      logger.warn('USER', 'User không tồn tại', { userId });
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }
    res.json(user);
  }),

  create: handle(async (req, res) => {
    logger.info('USER', 'Yêu cầu tạo user mới', { email: req.body.email });
    try {
      const created = await UserService.create({}, req.body);
      logger.info('USER', 'Tạo user thành công', { userId: created.id, email: created.email });
      res.status(201).json(created);
    } catch (e) {
      logger.error('USER', 'Tạo user thất bại', { error: e.message, email: req.body.email });
      if (e.message.includes("Email đã tồn tại")) {
        return res.status(400).json({ message: e.message });
      }
      throw e;
    }
  }),

  update: handle(async (req, res) => {
    const userId = req.params.userId;
    logger.info('USER', 'Yêu cầu cập nhật user', { userId });
    try {
      const updated = await UserService.update({}, userId, req.body);
      if (!updated) {
        logger.warn('USER', 'Cập nhật thất bại - user không tồn tại', { userId });
        return res.status(404).json({ message: "Người dùng không tồn tại" });
      }
      logger.info('USER', 'Cập nhật user thành công', { userId });
      res.json(updated);
    } catch (e) {
      logger.error('USER', 'Cập nhật user thất bại', { error: e.message, userId });
      throw e;
    }
  }),

  remove: handle(async (req, res) => {
    const userId = req.params.userId;
    logger.info('USER', 'Yêu cầu xóa user', { userId });
    try {
      await UserService.remove({}, userId);
      logger.info('USER', 'Xóa user thành công', { userId });
      res.json({ message: "Đã xóa người dùng" });
    } catch (e) {
      logger.error('USER', 'Xóa user thất bại', { error: e.message, userId });
      throw e;
    }
  }),

  getProfile: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.debug('USER', 'Lấy profile của user', { userId });
    const user = await UserService.detail(userId);
    if (!user) {
      logger.warn('USER', 'User không tồn tại khi lấy profile', { userId });
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }
    const { password_hash, ...userProfile } = user;
    res.json(userProfile);
  }),

  updateProfile: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.info('USER', 'Yêu cầu cập nhật profile', { userId });
    const { password, ...updateData } = req.body;
    try {
      const updated = await UserService.update({}, userId, updateData);
      if (!updated) {
        logger.warn('USER', 'Cập nhật profile thất bại - user không tồn tại', { userId });
        return res.status(404).json({ message: "Người dùng không tồn tại" });
      }
      const { password_hash, ...userProfile } = updated;
      logger.info('USER', 'Cập nhật profile thành công', { userId });
      res.json(userProfile);
    } catch (e) {
      logger.error('USER', 'Cập nhật profile thất bại', { error: e.message, userId });
      throw e;
    }
  }),

  changePassword: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const { currentPassword, newPassword } = req.body;
    logger.info('USER', 'Yêu cầu đổi mật khẩu', { userId });

    try {
      // Lấy user với password_hash
      const user = await UserModel.findById(userId);
      if (!user) {
        logger.warn('USER', 'Đổi mật khẩu thất bại - user không tồn tại', { userId });
        return res.status(404).json({ message: "Người dùng không tồn tại" });
      }

      // Kiểm tra mật khẩu hiện tại
      const isPasswordCorrect = await comparePassword(currentPassword, user.password_hash);
      if (!isPasswordCorrect) {
        logger.warn('USER', 'Đổi mật khẩu thất bại - mật khẩu hiện tại sai', { userId });
        return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
      }

      // Hash mật khẩu mới và cập nhật
      const newPasswordHash = await hashPassword(newPassword);
      await UserModel.findByIdAndUpdate(userId, { password_hash: newPasswordHash });

      logger.info('USER', 'Đổi mật khẩu thành công', { userId });
      res.json({ message: "Đổi mật khẩu thành công" });
    } catch (e) {
      logger.error('USER', 'Đổi mật khẩu thất bại', { error: e.message, userId });
      throw e;
    }
  }),
};

