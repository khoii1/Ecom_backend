import { PasswordResetTokenService } from '../services/password_reset_token.service.js';
import { handle } from './base.controller.js';

export const PasswordResetTokenController = {
  list: handle(async (req, res) => res.json(await PasswordResetTokenService.list())),
  detail: handle(async (req, res) => {
    const data = await PasswordResetTokenService.detail(req.params.passwordResetTokenId);
    if (!data) return res.status(404).json({ message: 'Token khôi phục không tồn tại' });
    res.json(data);
  }),
  create: handle(async (req, res) => {
    const created = await PasswordResetTokenService.create(req.currentUser || {}, req.body);
    res.status(201).json(created);
  }),
  update: handle(async (req, res) => {
    try {
      const updated = await PasswordResetTokenService.update(req.currentUser || {}, req.params.passwordResetTokenId, req.body);
      if (!updated) return res.status(404).json({ message: 'Token khôi phục không tồn tại' });
      res.json(updated);
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ message: 'Không được phép' });
      throw e;
    }
  }),
  remove: handle(async (req, res) => {
    try {
      await PasswordResetTokenService.remove(req.currentUser || {}, req.params.passwordResetTokenId);
      res.json({ message: 'Đã xóa' });
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ message: 'Không được phép' });
      throw e;
    }
  }),
};
