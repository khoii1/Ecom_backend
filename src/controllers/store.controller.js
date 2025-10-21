import { StoreService } from "../services/store.service.js";
import { handle } from "./base.controller.js";

export const StoreController = {
  list: handle(async (req, res) => res.json(await StoreService.list())),

  // Lấy stores của user hiện tại (for sellers)
  myStores: handle(async (req, res) => {
    const stores = await StoreService.listByOwner(req.currentUser.id);
    res.json(stores);
  }),

  detail: handle(async (req, res) => {
    const data = await StoreService.detail(req.params.storeId);
    if (!data)
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    res.json(data);
  }),
  create: handle(async (req, res) => {
    const created = await StoreService.create(req.currentUser || {}, req.body);
    res.status(201).json(created);
  }),
  update: handle(async (req, res) => {
    try {
      const updated = await StoreService.update(
        req.currentUser || {},
        req.params.storeId,
        req.body
      );
      if (!updated)
        return res.status(404).json({ message: "Cửa hàng không tồn tại" });
      res.json(updated);
    } catch (e) {
      if (e.message.includes("không có quyền"))
        return res.status(403).json({ message: e.message });
      throw e;
    }
  }),
  remove: handle(async (req, res) => {
    try {
      await StoreService.remove(req.currentUser || {}, req.params.storeId);
      res.json({ message: "Xóa cửa hàng thành công" });
    } catch (e) {
      if (e.message.includes("không có quyền"))
        return res.status(403).json({ message: e.message });
      throw e;
    }
  }),
};
