import { ProductVariantService } from "../services/product_variant.service.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";

export const ProductVariantController = {
  getByProduct: handle(async (req, res) => {
    const productId = req.params.productId;
    logger.debug('VARIANT', 'Lấy danh sách biến thể sản phẩm', { productId });
    const variants = await ProductVariantService.getProductVariants(productId);
    logger.info('VARIANT', `Trả về ${variants.length} biến thể`, { productId });
    res.json(variants);
  }),

  getById: handle(async (req, res) => {
    const variantId = req.params.variantId;
    logger.debug('VARIANT', 'Lấy biến thể theo ID', { variantId });
    const variant = await ProductVariantService.getVariantById(variantId);
    if (!variant) {
      return res.status(404).json({ message: "Biến thể không tồn tại" });
    }
    res.json(variant);
  }),

  create: handle(async (req, res) => {
    const productId = req.params.productId;
    logger.info('VARIANT', 'Tạo biến thể mới', { productId });
    const variant = await ProductVariantService.createVariant(productId, req.body, req.currentUser);
    logger.info('VARIANT', 'Tạo biến thể thành công', { variantId: variant.id, productId });
    res.status(201).json(variant);
  }),

  update: handle(async (req, res) => {
    const variantId = req.params.variantId;
    logger.info('VARIANT', 'Cập nhật biến thể', { variantId });
    const variant = await ProductVariantService.updateVariant(variantId, req.body, req.currentUser);
    logger.info('VARIANT', 'Cập nhật biến thể thành công', { variantId });
    res.json(variant);
  }),

  delete: handle(async (req, res) => {
    const variantId = req.params.variantId;
    logger.info('VARIANT', 'Xóa biến thể', { variantId });
    await ProductVariantService.deleteVariant(variantId, req.currentUser);
    logger.info('VARIANT', 'Xóa biến thể thành công', { variantId });
    res.json({ message: "Đã xóa biến thể" });
  }),
};

