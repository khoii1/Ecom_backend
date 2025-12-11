import { WalletModel } from "../models/wallet.model.js";
import { WalletTransactionModel } from "../models/wallet_transaction.model.js";
import { logger } from "../utils/logger.js";

const formatWalletForFrontend = (wallet) => {
  if (!wallet) return wallet;
  return {
    ...wallet,
    id: wallet._id.toString(),
    user_id: wallet.user_id?.toString() || wallet.user_id,
  };
};

const formatTransactionForFrontend = (transaction) => {
  if (!transaction) return transaction;
  return {
    ...transaction,
    id: transaction._id.toString(),
    wallet_id: transaction.wallet_id?.toString() || transaction.wallet_id,
    user_id: transaction.user_id?.toString() || transaction.user_id,
  };
};

const formatTransactionsForFrontend = (transactions) => {
  if (!Array.isArray(transactions)) return transactions;
  return transactions.map(formatTransactionForFrontend);
};

export const WalletService = {
  /**
   * Lấy hoặc tạo ví cho user (tự động tạo nếu chưa có)
   */
  async getOrCreateWallet(userId) {
    let wallet = await WalletModel.findOne({ user_id: userId }).lean();

    if (!wallet) {
      // Tự động tạo ví mới
      wallet = await WalletModel.create({
        user_id: userId,
        balance: 0,
        status: "active",
      });
      wallet = wallet.toObject();
      logger.info("WALLET", "Tự động tạo ví mới", { userId, walletId: wallet._id.toString() });
    }

    return formatWalletForFrontend(wallet);
  },

  /**
   * Lấy số dư ví
   */
  async getBalance(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    return wallet.balance;
  },

  /**
   * Tạo yêu cầu nạp tiền (tạo transaction pending)
   */
  async createTopupRequest(userId, amount, description = null) {
    // Kiểm tra số tiền
    if (amount <= 0) {
      throw new Error("Số tiền nạp phải lớn hơn 0");
    }
    if (amount < 10000) {
      throw new Error("Số tiền nạp tối thiểu là 10,000 VNĐ");
    }
    if (amount > 50000000) {
      throw new Error("Số tiền nạp tối đa là 50,000,000 VNĐ");
    }

    // Lấy hoặc tạo ví
    const wallet = await WalletModel.findOne({ user_id: userId });
    if (!wallet) {
      await WalletModel.create({
        user_id: userId,
        balance: 0,
        status: "active",
      });
    }

    const walletDoc = await WalletModel.findOne({ user_id: userId });

    // Tạo transaction pending
    const transaction = await WalletTransactionModel.create({
      wallet_id: walletDoc._id,
      user_id: userId,
      type: "topup",
      amount: amount,
      status: "pending",
      reference_type: "topup",
      description: description || `Nạp tiền vào ví: ${amount.toLocaleString("vi-VN")} VNĐ`,
    });

    logger.info("WALLET", "Tạo yêu cầu nạp tiền", {
      userId,
      amount,
      transactionId: transaction._id.toString(),
    });

    return formatTransactionForFrontend(transaction.toObject());
  },

  /**
   * Cập nhật trạng thái nạp tiền sau khi VNPay IPN callback
   */
  async updateTopupStatus(transactionId, vnpResponseCode, vnpTransactionRef) {
    const transaction = await WalletTransactionModel.findById(transactionId).lean();

    if (!transaction) {
      throw new Error("Giao dịch nạp tiền không tồn tại");
    }

    if (transaction.status !== "pending") {
      logger.warn("WALLET", "Giao dịch đã được xử lý", {
        transactionId,
        currentStatus: transaction.status,
      });
      return formatTransactionForFrontend(transaction);
    }

    // Kiểm tra response code từ VNPay
    const isSuccess = vnpResponseCode === "00";

    if (isSuccess) {
      // Cập nhật số dư ví
      await WalletModel.findByIdAndUpdate(transaction.wallet_id, {
        $inc: { balance: transaction.amount },
      });

      // Cập nhật transaction status
      await WalletTransactionModel.findByIdAndUpdate(transactionId, {
        $set: {
          status: "completed",
          vnp_transaction_ref: vnpTransactionRef,
          vnp_response_code: vnpResponseCode,
        },
      });

      logger.info("WALLET", "Nạp tiền thành công", {
        userId: transaction.user_id.toString(),
        amount: transaction.amount,
        transactionId,
      });
    } else {
      // Cập nhật transaction status = failed
      await WalletTransactionModel.findByIdAndUpdate(transactionId, {
        $set: {
          status: "failed",
          vnp_transaction_ref: vnpTransactionRef,
          vnp_response_code: vnpResponseCode,
        },
      });

      logger.warn("WALLET", "Nạp tiền thất bại", {
        userId: transaction.user_id.toString(),
        amount: transaction.amount,
        transactionId,
        responseCode: vnpResponseCode,
      });
    }

    const updated = await WalletTransactionModel.findById(transactionId).lean();
    return formatTransactionForFrontend(updated);
  },

  /**
   * Trừ tiền từ ví (khi thanh toán đơn hàng)
   */
  async deduct(userId, amount, referenceId, referenceType = "order", description = null) {
    if (amount <= 0) {
      throw new Error("Số tiền phải lớn hơn 0");
    }

    const wallet = await WalletModel.findOne({ user_id: userId });

    if (!wallet) {
      throw new Error("Ví không tồn tại");
    }

    if (wallet.status !== "active") {
      throw new Error("Ví đang bị khóa hoặc đã đóng");
    }

    if (wallet.balance < amount) {
      throw new Error(
        `Số dư ví không đủ. Số dư hiện tại: ${wallet.balance.toLocaleString("vi-VN")} VNĐ, cần: ${amount.toLocaleString("vi-VN")} VNĐ`
      );
    }

    // Trừ tiền từ ví
    await WalletModel.findByIdAndUpdate(wallet._id, {
      $inc: { balance: -amount },
    });

    // Tạo transaction
    const transaction = await WalletTransactionModel.create({
      wallet_id: wallet._id,
      user_id: userId,
      type: "payment",
      amount: amount,
      status: "completed",
      reference_id: referenceId,
      reference_type: referenceType,
      description: description || `Thanh toán đơn hàng: ${amount.toLocaleString("vi-VN")} VNĐ`,
    });

    logger.info("WALLET", "Trừ tiền từ ví thành công", {
      userId,
      amount,
      referenceId,
      transactionId: transaction._id.toString(),
    });

    return formatTransactionForFrontend(transaction.toObject());
  },

  /**
   * Thêm tiền vào ví (khi hoàn tiền)
   */
  async add(userId, amount, referenceId, referenceType = "return", description = null) {
    if (amount <= 0) {
      throw new Error("Số tiền phải lớn hơn 0");
    }

    const wallet = await WalletModel.findOne({ user_id: userId });

    if (!wallet) {
      // Tự động tạo ví nếu chưa có
      await WalletModel.create({
        user_id: userId,
        balance: 0,
        status: "active",
      });
    }

    const walletDoc = await WalletModel.findOne({ user_id: userId });

    if (walletDoc.status !== "active") {
      throw new Error("Ví đang bị khóa hoặc đã đóng");
    }

    // Thêm tiền vào ví
    await WalletModel.findByIdAndUpdate(walletDoc._id, {
      $inc: { balance: amount },
    });

    // Tạo transaction
    const transaction = await WalletTransactionModel.create({
      wallet_id: walletDoc._id,
      user_id: userId,
      type: "refund",
      amount: amount,
      status: "completed",
      reference_id: referenceId,
      reference_type: referenceType,
      description: description || `Hoàn tiền: ${amount.toLocaleString("vi-VN")} VNĐ`,
    });

    logger.info("WALLET", "Thêm tiền vào ví thành công", {
      userId,
      amount,
      referenceId,
      transactionId: transaction._id.toString(),
    });

    return formatTransactionForFrontend(transaction.toObject());
  },

  /**
   * Lấy lịch sử giao dịch
   */
  async getTransactions(userId, filters = {}) {
    const { type, status, limit = 50, offset = 0 } = filters;

    const query = { user_id: userId };

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    const transactions = await WalletTransactionModel.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await WalletTransactionModel.countDocuments(query);

    return {
      transactions: formatTransactionsForFrontend(transactions),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };
  },

  /**
   * Lấy chi tiết giao dịch
   */
  async getTransactionDetail(transactionId, userId) {
    const transaction = await WalletTransactionModel.findOne({
      _id: transactionId,
      user_id: userId,
    }).lean();

    if (!transaction) {
      throw new Error("Giao dịch không tồn tại hoặc bạn không có quyền xem");
    }

    return formatTransactionForFrontend(transaction);
  },
};

