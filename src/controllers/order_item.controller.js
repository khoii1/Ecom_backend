import { OrderItemService } from '../services/order_item.service.js';
import { handle } from './base.controller.js';

export const OrderItemController = {
  list: handle(async (req, res) => res.json(await OrderItemService.list())),
  detail: handle(async (req, res) => {
    const data = await OrderItemService.detail(req.params.orderItemId);
    if (!data) return res.status(404).json({ message: 'Mục đơn hàng không tồn tại' });
    res.json(data);
  }),
  create: handle(async (req, res) => {
    const created = await OrderItemService.create(req.currentUser || {}, req.body);
    res.status(201).json(created);
  }),
  update: handle(async (req, res) => {
    try {
      const updated = await OrderItemService.update(req.currentUser || {}, req.params.orderItemId, req.body);
      if (!updated) return res.status(404).json({ message: 'Mục đơn hàng không tồn tại' });
      res.json(updated);
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ message: 'Không được phép' });
      throw e;
    }
  }),
  remove: handle(async (req, res) => {
    try {
      await OrderItemService.remove(req.currentUser || {}, req.params.orderItemId);
      res.json({ message: 'Đã xóa' });
    } catch (e) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ message: 'Không được phép' });
      throw e;
    }
  }),
};
