import { ProductService } from "../services/product.service.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";

export const ProductController = {
  list: handle(async (req, res) => {
    // Lấy các tham số lọc từ query string
    const filters = {
      category_id: req.query.category_id || null, // MongoDB ObjectId là string
      min_price: req.query.min_price ? parseFloat(req.query.min_price) : null,
      max_price: req.query.max_price ? parseFloat(req.query.max_price) : null,
      store_id: req.query.store_id || null, // MongoDB ObjectId là string
      search: req.query.search || null,
      min_rating: req.query.min_rating ? parseFloat(req.query.min_rating) : null,
      sort: req.query.sort || null,
    };

    // Loại bỏ các giá trị null
    Object.keys(filters).forEach(key => {
      if (filters[key] === null) delete filters[key];
    });

    logger.debug('PRODUCT', 'Lấy danh sách sản phẩm', { filters });
    const products = await ProductService.list(filters);
    logger.info('PRODUCT', `Trả về ${products.length} sản phẩm`);
    res.json(products);
  }),
  detail: handle(async (req, res) => {
    const productId = req.params.productId;
    logger.debug('PRODUCT', 'Lấy chi tiết sản phẩm', { productId });
    const data = await ProductService.detail(productId);
    if (!data) {
      logger.warn('PRODUCT', 'Sản phẩm không tồn tại', { productId });
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }
    res.json(data);
  }),
  create: handle(async (req, res) => {
    const userId = req.currentUser?.id;
    logger.info('PRODUCT', 'Yêu cầu tạo sản phẩm mới', { userId, productName: req.body.name });
    try {
      const created = await ProductService.create(
        req.currentUser || {},
        req.body
      );
      logger.info('PRODUCT', 'Tạo sản phẩm thành công', { productId: created.id, productName: created.name, userId });
      res.status(201).json(created);
    } catch (e) {
      logger.error('PRODUCT', 'Tạo sản phẩm thất bại', { error: e.message, userId });
      if (e.message.includes("không tìm thấy cửa hàng"))
        return res.status(404).json({ message: e.message });
      if (e.message.includes("không có quyền"))
        return res.status(403).json({ message: e.message });
      throw e;
    }
  }),
  update: handle(async (req, res) => {
    const userId = req.currentUser?.id;
    const productId = req.params.productId;
    logger.info('PRODUCT', 'Yêu cầu cập nhật sản phẩm', { productId, userId });
    try {
      const updated = await ProductService.update(
        req.currentUser || {},
        productId,
        req.body
      );
      if (!updated) {
        logger.warn('PRODUCT', 'Cập nhật thất bại - sản phẩm không tồn tại', { productId });
        return res.status(404).json({ message: "Sản phẩm không tồn tại" });
      }
      logger.info('PRODUCT', 'Cập nhật sản phẩm thành công', { productId, userId });
      res.json(updated);
    } catch (e) {
      logger.error('PRODUCT', 'Cập nhật sản phẩm thất bại', { error: e.message, productId, userId });
      if (e.message.includes("không có quyền"))
        return res.status(403).json({ message: e.message });
      throw e;
    }
  }),
  remove: handle(async (req, res) => {
    const userId = req.currentUser?.id;
    const productId = req.params.productId;
    logger.info('PRODUCT', 'Yêu cầu xóa sản phẩm', { productId, userId });
    try {
      await ProductService.remove(req.currentUser || {}, productId);
      logger.info('PRODUCT', 'Xóa sản phẩm thành công', { productId, userId });
      res.json({ message: "Xóa sản phẩm thành công" });
    } catch (e) {
      logger.error('PRODUCT', 'Xóa sản phẩm thất bại', { error: e.message, productId, userId });
      if (e.message.includes("không có quyền"))
        return res.status(403).json({ message: e.message });
      throw e;
    }
  }),

  // Upload hình ảnh cho sản phẩm
  uploadImage: handle(async (req, res) => {
    const userId = req.currentUser?.id;
    if (!req.file) {
      logger.warn('PRODUCT', 'Upload thất bại - không có file', { userId });
      return res.status(400).json({
        message: "Vui lòng chọn file hình ảnh để upload",
      });
    }

    // Cloudinary tự động trả về secure_url sau khi upload
    const imageUrl = req.file.path; // Cloudinary URL
    const publicId = req.file.filename; // Cloudinary public_id

    logger.info('PRODUCT', 'Upload hình ảnh thành công', { 
      userId, 
      publicId, 
      originalFilename: req.file.originalname 
    });

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
