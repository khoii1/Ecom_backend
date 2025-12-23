import { ShippingService } from "../services/shipping.service.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";

export const ShippingController = {
  /**
   * Tính phí vận chuyển
   * POST /shipping/calculate
   * Body: { shipping_code, origin, destination, weight, total_value }
   */
  calculate: handle(async (req, res) => {
    const { shipping_code, origin, destination, weight, total_value } =
      req.body;

    if (!shipping_code) {
      return res.status(400).json({ message: "shipping_code là bắt buộc" });
    }

    if (!destination) {
      return res.status(400).json({ message: "destination là bắt buộc" });
    }

    try {
      const fee = await ShippingService.calculateShippingFee(shipping_code, {
        origin: origin || null,
        destination,
        weight: weight || 1,
        totalValue: total_value || 0,
      });

      logger.info("SHIPPING", "Tính phí vận chuyển thành công", {
        shipping_code,
        fee: fee.calculated_fee,
      });

      res.json(fee);
    } catch (error) {
      logger.error("SHIPPING", `Lỗi tính phí vận chuyển: ${error.message}`);
      return res.status(400).json({ message: error.message });
    }
  }),

  /**
   * Tính phí cho tất cả phương thức vận chuyển
   * POST /shipping/calculate-all
   * Body: { origin, destination, weight, total_value }
   */
  calculateAll: handle(async (req, res) => {
    const { origin, destination, weight, total_value } = req.body;

    if (!destination) {
      return res.status(400).json({ message: "destination là bắt buộc" });
    }

    try {
      // Nếu không có origin, thử lấy từ cart của user
      let finalOrigin = origin;
      if (!finalOrigin && req.currentUser) {
        try {
          const { CartItemModel } = await import(
            "../models/cart_item.model.js"
          );
          const { StoreModel } = await import("../models/store.model.js");
          const { CartModel } = await import("../models/cart.model.js");

          // Lấy cart_id của user
          const cart = await CartModel.findOne({
            user_id: req.currentUser.id,
          }).lean();
          if (cart) {
            // Lấy cart item đầu tiên với product và store
            const cartItem = await CartItemModel.findOne({ cart_id: cart._id })
              .populate({
                path: "product_id",
                select: "store_id",
                populate: {
                  path: "store_id",
                  select: "lat lon address",
                },
              })
              .lean();

            if (
              cartItem &&
              cartItem.product_id &&
              cartItem.product_id.store_id
            ) {
              const store = cartItem.product_id.store_id;
              if (store.lat && store.lon) {
                finalOrigin = {
                  lat: store.lat,
                  lon: store.lon,
                  address: store.address || "",
                };
                logger.info("SHIPPING", "Tự động lấy origin từ store", {
                  store_id: store._id,
                  lat: store.lat,
                  lon: store.lon,
                });
              }
            }
          }
        } catch (error) {
          logger.warn(
            "SHIPPING",
            `Không thể lấy origin từ cart: ${error.message}`
          );
        }
      }

      const fees = await ShippingService.calculateMultipleShippingFees({
        origin: finalOrigin || null,
        destination,
        weight: weight || 1,
        totalValue: total_value || 0,
      });

      logger.info(
        "SHIPPING",
        `Tính phí cho ${fees.length} phương thức vận chuyển`
      );

      res.json({ shipping_options: fees });
    } catch (error) {
      logger.error("SHIPPING", `Lỗi tính phí vận chuyển: ${error.message}`);
      return res.status(500).json({ message: error.message });
    }
  }),

  /**
   * Lấy danh sách phương thức vận chuyển
   * GET /shipping/methods
   */
  getMethods: handle(async (req, res) => {
    try {
      const includeInactive = req.query.include_inactive === "true";
      const methods = await ShippingService.getAllShippingMethods(
        includeInactive
      );
      res.json(methods);
    } catch (error) {
      logger.error(
        "SHIPPING",
        `Lỗi lấy danh sách phương thức: ${error.message}`
      );
      return res.status(500).json({ message: error.message });
    }
  }),

  /**
   * Tạo phương thức vận chuyển mới (Admin only)
   * POST /shipping/methods
   */
  create: handle(async (req, res) => {
    try {
      const method = await ShippingService.createShippingMethod(req.body);
      logger.info("SHIPPING", "Tạo phương thức vận chuyển mới", {
        code: method.code,
      });
      res.status(201).json(method);
    } catch (error) {
      logger.error("SHIPPING", `Lỗi tạo phương thức: ${error.message}`);
      return res.status(400).json({ message: error.message });
    }
  }),

  /**
   * Cập nhật phương thức vận chuyển (Admin only)
   * PUT /shipping/methods/:id
   */
  update: handle(async (req, res) => {
    try {
      const method = await ShippingService.updateShippingMethod(
        req.params.id,
        req.body
      );
      logger.info("SHIPPING", "Cập nhật phương thức vận chuyển", {
        id: req.params.id,
      });
      res.json(method);
    } catch (error) {
      logger.error("SHIPPING", `Lỗi cập nhật phương thức: ${error.message}`);
      return res.status(400).json({ message: error.message });
    }
  }),

  /**
   * Xóa phương thức vận chuyển (Admin only)
   * DELETE /shipping/methods/:id
   */
  delete: handle(async (req, res) => {
    try {
      await ShippingService.deleteShippingMethod(req.params.id);
      logger.info("SHIPPING", "Xóa phương thức vận chuyển", {
        id: req.params.id,
      });
      res.json({ message: "Xóa phương thức vận chuyển thành công" });
    } catch (error) {
      logger.error("SHIPPING", `Lỗi xóa phương thức: ${error.message}`);
      return res.status(400).json({ message: error.message });
    }
  }),
};
