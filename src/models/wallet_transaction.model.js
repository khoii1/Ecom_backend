import { mongoose } from "../config/database.js";

const walletTransactionSchema = new mongoose.Schema(
  {
    wallet_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["topup", "payment", "refund", "withdrawal"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
    },
    reference_id: {
      type: String,
      default: null, // order_id, return_id, hoặc topup_id
    },
    reference_type: {
      type: String,
      enum: ["order", "topup", "return", "withdrawal"],
      default: null,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    vnp_transaction_ref: {
      type: String,
      default: null, // VNPay transaction reference (cho topup)
    },
    vnp_response_code: {
      type: String,
      default: null, // Lưu response code từ VNPay
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
walletTransactionSchema.index({ wallet_id: 1 });
walletTransactionSchema.index({ user_id: 1 });
walletTransactionSchema.index({ type: 1 });
walletTransactionSchema.index({ status: 1 });
walletTransactionSchema.index({ reference_id: 1 });
walletTransactionSchema.index({ vnp_transaction_ref: 1 });
walletTransactionSchema.index({ createdAt: -1 });

export const WalletTransactionModel = mongoose.model(
  "WalletTransaction",
  walletTransactionSchema
);

