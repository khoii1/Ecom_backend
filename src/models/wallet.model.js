import { mongoose } from "../config/database.js";

const walletSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Mỗi user chỉ có 1 ví
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "frozen", "closed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Note: user_id index is automatically created by unique: true
walletSchema.index({ status: 1 });

export const WalletModel = mongoose.model("Wallet", walletSchema);

