import { ReturnService } from "../services/return.service.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";

export const ReturnController = {
  // Customer: Tạo return request
  create: handle(async (req, res) => {
    try {
      const returnRequest = await ReturnService.create(
        req.currentUser,
        req.body
      );
      logger.info("RETURN", "Tạo return request thành công", {
        returnId: returnRequest.id,
        userId: req.currentUser.id,
      });
      res.status(201).json({
        message: "Yêu cầu trả hàng đã được tạo thành công",
        data: returnRequest,
      });
    } catch (error) {
      logger.error("RETURN", "Lỗi khi tạo return request", {
        error: error.message,
        userId: req.currentUser.id,
      });
      if (error.message.includes("không có quyền")) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes("không tồn tại")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }),

  // Customer: Lấy danh sách returns của mình
  listMyReturns: handle(async (req, res) => {
    try {
      const returns = await ReturnService.listMyReturns(req.currentUser.id);
      res.json(returns);
    } catch (error) {
      logger.error("RETURN", "Lỗi khi lấy danh sách returns", {
        error: error.message,
        userId: req.currentUser.id,
      });
      res.status(500).json({ message: error.message });
    }
  }),

  // Seller: Lấy danh sách returns của store
  listByStore: handle(async (req, res) => {
    try {
      const returns = await ReturnService.listByStore(req.params.storeId);
      res.json(returns);
    } catch (error) {
      logger.error("RETURN", "Lỗi khi lấy danh sách returns của store", {
        error: error.message,
        storeId: req.params.storeId,
      });
      res.status(500).json({ message: error.message });
    }
  }),

  // Chi tiết return
  detail: handle(async (req, res) => {
    try {
      const returnDoc = await ReturnService.detail(
        req.params.returnId,
        req.currentUser
      );
      res.json(returnDoc);
    } catch (error) {
      logger.error("RETURN", "Lỗi khi lấy chi tiết return", {
        error: error.message,
        returnId: req.params.returnId,
      });
      if (error.message.includes("không tồn tại")) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes("không có quyền")) {
        return res.status(403).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  }),

  // Seller/Admin: Approve return
  approve: handle(async (req, res) => {
    try {
      const { admin_note } = req.body;
      const updated = await ReturnService.approve(
        req.params.returnId,
        req.currentUser,
        admin_note
      );
      logger.info("RETURN", "Duyệt return thành công", {
        returnId: req.params.returnId,
        approvedBy: req.currentUser.id,
      });
      res.json({
        message: "Yêu cầu trả hàng đã được duyệt",
        data: updated,
      });
    } catch (error) {
      logger.error("RETURN", "Lỗi khi duyệt return", {
        error: error.message,
        returnId: req.params.returnId,
      });
      if (error.message.includes("không có quyền")) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes("không tồn tại")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }),

  // Seller/Admin: Reject return
  reject: handle(async (req, res) => {
    try {
      const { admin_note } = req.body;
      if (!admin_note) {
        return res
          .status(400)
          .json({ message: "Vui lòng cung cấp lý do từ chối" });
      }
      const updated = await ReturnService.reject(
        req.params.returnId,
        req.currentUser,
        admin_note
      );
      logger.info("RETURN", "Từ chối return thành công", {
        returnId: req.params.returnId,
        rejectedBy: req.currentUser.id,
      });
      res.json({
        message: "Yêu cầu trả hàng đã bị từ chối",
        data: updated,
      });
    } catch (error) {
      logger.error("RETURN", "Lỗi khi từ chối return", {
        error: error.message,
        returnId: req.params.returnId,
      });
      if (error.message.includes("không có quyền")) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes("không tồn tại")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }),

  // Seller/Admin: Process return
  process: handle(async (req, res) => {
    try {
      const updated = await ReturnService.process(
        req.params.returnId,
        req.currentUser
      );
      logger.info("RETURN", "Xử lý return thành công", {
        returnId: req.params.returnId,
        processedBy: req.currentUser.id,
      });
      res.json({
        message: "Yêu cầu trả hàng đang được xử lý",
        data: updated,
      });
    } catch (error) {
      logger.error("RETURN", "Lỗi khi xử lý return", {
        error: error.message,
        returnId: req.params.returnId,
      });
      if (error.message.includes("không có quyền")) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes("không tồn tại")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }),

  // Seller/Admin: Complete return
  complete: handle(async (req, res) => {
    try {
      const updated = await ReturnService.complete(
        req.params.returnId,
        req.currentUser
      );
      logger.info("RETURN", "Hoàn tất return thành công", {
        returnId: req.params.returnId,
        completedBy: req.currentUser.id,
      });
      res.json({
        message: "Yêu cầu trả hàng đã được hoàn tất",
        data: updated,
      });
    } catch (error) {
      logger.error("RETURN", "Lỗi khi hoàn tất return", {
        error: error.message,
        returnId: req.params.returnId,
      });
      if (error.message.includes("không có quyền")) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes("không tồn tại")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }),

  // Customer: Cancel return
  cancel: handle(async (req, res) => {
    try {
      const updated = await ReturnService.cancel(
        req.params.returnId,
        req.currentUser
      );
      logger.info("RETURN", "Hủy return thành công", {
        returnId: req.params.returnId,
        userId: req.currentUser.id,
      });
      res.json({
        message: "Yêu cầu trả hàng đã được hủy",
        data: updated,
      });
    } catch (error) {
      logger.error("RETURN", "Lỗi khi hủy return", {
        error: error.message,
        returnId: req.params.returnId,
      });
      if (error.message.includes("không có quyền")) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes("không tồn tại")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }),

  // Seller/Admin: Create exchange order
  createExchangeOrder: handle(async (req, res) => {
    try {
      const exchangeOrder = await ReturnService.createExchangeOrder(
        req.params.returnId,
        req.currentUser
      );
      logger.info("RETURN", "Tạo exchange order thành công", {
        returnId: req.params.returnId,
        exchangeOrderId: exchangeOrder.id,
        createdBy: req.currentUser.id,
      });
      res.status(201).json({
        message: "Đơn hàng đổi đã được tạo thành công",
        data: exchangeOrder,
      });
    } catch (error) {
      logger.error("RETURN", "Lỗi khi tạo exchange order", {
        error: error.message,
        returnId: req.params.returnId,
      });
      if (error.message.includes("không có quyền")) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes("không tồn tại")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }),

  // Customer: Hủy return request (chỉ khi status = pending)
  cancel: handle(async (req, res) => {
    try {
      const returnRequest = await ReturnService.cancel(
        req.params.returnId,
        req.currentUser
      );
      logger.info("RETURN", "Hủy return request thành công", {
        returnId: req.params.returnId,
        userId: req.currentUser.id,
      });
      res.json({
        message: "Đã hủy yêu cầu trả hàng",
        data: returnRequest,
      });
    } catch (error) {
      logger.error("RETURN", "Lỗi khi hủy return request", {
        error: error.message,
        returnId: req.params.returnId,
      });
      if (error.message.includes("không có quyền")) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes("không tồn tại")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }),
};
