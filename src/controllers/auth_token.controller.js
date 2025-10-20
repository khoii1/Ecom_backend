import { AuthTokenService } from '../services/auth_token.service.js';
import { handle } from './base.controller.js';

export const AuthTokenController = {
  list: handle(async (req, res) => res.json(await AuthTokenService.list())),
  detail: handle(async (req, res) => {
    const data = await AuthTokenService.detail(req.params.authTokenId);
    if (!data) return res.status(404).json({ message: 'Auth token không tồn tại' });
    res.json(data);
  }),
  create: handle(async (req, res) => {
    const created = await AuthTokenService.create(req.currentUser || {}, req.body);
    res.status(201).json(created);
  }),
  update: handle(async (req, res) => {
    try {
      const updated = await AuthTokenService.update(req.currentUser || {}, req.params.authTokenId, req.body);
      if (!updated) return res.status(404).json({ message: 'Auth token không tồn tại' });
      res.json(updated);
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ message: 'Không được phép' });
      throw e;
    }
  }),
  remove: handle(async (req, res) => {
    try {
      await AuthTokenService.remove(req.currentUser || {}, req.params.authTokenId);
      res.json({ message: 'Đã xóa' });
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ message: 'Không được phép' });
      throw e;
    }
  }),
};
