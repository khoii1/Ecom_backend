import { ProductService } from "../services/product.service.js";
import { handle } from "./base.controller.js";

export const ProductController = {
  list: handle(async (req, res) => res.json(await ProductService.list())),
  detail: handle(async (req, res) => {
    const data = await ProductService.detail(req.params.productId);
    if (!data)
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    res.json(data);
  }),
  create: handle(async (req, res) => {
    try {
      const created = await ProductService.create(
        req.currentUser || {},
        req.body
      );
      res.status(201).json(created);
    } catch (e) {
      if (e.message.includes("không tìm thấy cửa hàng"))
        return res.status(404).json({ message: e.message });
      if (e.message.includes("không có quyền"))
        return res.status(403).json({ message: e.message });
      throw e;
    }
  }),
  update: handle(async (req, res) => {
    try {
      const updated = await ProductService.update(
        req.currentUser || {},
        req.params.productId,
        req.body
      );
      if (!updated)
        return res.status(404).json({ message: "Sản phẩm không tồn tại" });
      res.json(updated);
    } catch (e) {
      if (e.message.includes("không có quyền"))
        return res.status(403).json({ message: e.message });
      throw e;
    }
  }),
  remove: handle(async (req, res) => {
    try {
      await ProductService.remove(req.currentUser || {}, req.params.productId);
      res.json({ message: "Xóa sản phẩm thành công" });
    } catch (e) {
      if (e.message.includes("không có quyền"))
        return res.status(403).json({ message: e.message });
      throw e;
    }
  }),

  // Upload hình ảnh cho sản phẩm
  uploadImage: handle(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        message: "Vui lòng chọn file hình ảnh để upload",
      });
    }

    // Cloudinary tự động trả về secure_url sau khi upload
    const imageUrl = req.file.path; // Cloudinary URL
    const publicId = req.file.filename; // Cloudinary public_id

    res.json({
      message: "Upload hình ảnh thành công",
      image_url: imageUrl,
      public_id: publicId,
      file_info: {
        original_filename: req.file.originalname,
        size: req.file.size,
        format: req.file.format,
        width: req.file.width,
        height: req.file.height,
      },
    });
  }),
};
