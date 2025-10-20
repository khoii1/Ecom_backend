import { CartItemService } from '../services/cart_item.service.js';
import { handle } from './base.controller.js';

export const CartItemController = {
  list: handle(async (req, res) => res.json(await CartItemService.list())),
  detail: handle(async (req, res) => {
    const data = await CartItemService.detail(req.params.cartItemId);
    if (!data) return res.status(404).json({ message: 'Mục giỏ hàng không tồn tại' });
    res.json(data);
  }),
  create: handle(async (req, res) => {
    const created = await CartItemService.create(req.currentUser || {}, req.body);
    res.status(201).json(created);
  }),
  update: handle(async (req, res) => {
    try {
      const updated = await CartItemService.update(req.currentUser || {}, req.params.cartItemId, req.body);
      if (!updated) return res.status(404).json({ message: 'Mục giỏ hàng không tồn tại' });
      res.json(updated);
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ message: 'Không được phép' });
      throw e;
    }
  }),
  remove: handle(async (req, res) => {
    try {
      await CartItemService.remove(req.currentUser || {}, req.params.cartItemId);
      res.json({ message: 'Đã xóa' });
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ message: 'Không được phép' });
      throw e;
    }
  }),
};
