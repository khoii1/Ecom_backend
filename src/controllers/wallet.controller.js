import { WalletService } from "../services/wallet.service.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";

export const WalletController = {
  getBalance: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.debug("WALLET", "Lấy số dư ví", { userId });
    const balance = await WalletService.getBalance(userId);
    const wallet = await WalletService.getOrCreateWallet(userId);
    res.json({
      balance,
      wallet_id: wallet.id,
      status: wallet.status,
    });
  }),

  createTopupRequest: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Số tiền nạp không hợp lệ" });
    }

    logger.info("WALLET", "Yêu cầu nạp tiền", { userId, amount });
    try {
      const transaction = await WalletService.createTopupRequest(
        userId,
        amount,
        description
      );
      logger.info("WALLET", "Tạo yêu cầu nạp tiền thành công", {
        userId,
        transactionId: transaction.id,
        amount,
      });
      res.status(201).json(transaction);
    } catch (e) {
      logger.error("WALLET", "Tạo yêu cầu nạp tiền thất bại", {
        error: e.message,
        userId,
        amount,
      });
      if (
        e.message.includes("tối thiểu") ||
        e.message.includes("tối đa") ||
        e.message.includes("lớn hơn 0")
      ) {
        return res.status(400).json({ message: e.message });
      }
      throw e;
    }
  }),

  getTransactions: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const { type, status, limit, offset } = req.query;

    logger.debug("WALLET", "Lấy lịch sử giao dịch", { userId, type, status });
    const result = await WalletService.getTransactions(userId, {
      type,
      status,
      limit,
      offset,
    });
    res.json(result);
  }),

  getTransactionDetail: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const transactionId = req.params.transactionId;

    logger.debug("WALLET", "Lấy chi tiết giao dịch", { userId, transactionId });
    try {
      const transaction = await WalletService.getTransactionDetail(
        transactionId,
        userId
      );
      res.json(transaction);
    } catch (e) {
      if (e.message.includes("không tồn tại") || e.message.includes("quyền")) {
        return res.status(404).json({ message: e.message });
      }
      throw e;
    }
  }),
};

