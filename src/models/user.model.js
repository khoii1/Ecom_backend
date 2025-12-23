import { mongoose } from "../config/database.js";

const userSchema = new mongoose.Schema(
  {
    full_name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    address: {
      type: String,
      default: null,
      trim: true,
    },
    role: {
      type: String,
      enum: ["USER", "SELLER", "ADMIN", "SHIPPER"],
      default: "USER",
    },
    status: {
      type: String,
      enum: ["pending", "active", "inactive"],
      default: "pending",
    },
  },
  {
    timestamps: true, // Tự động tạo created_at và updated_at
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

export const UserModel = mongoose.model("User", userSchema);

// Helper methods
UserModel.findByEmail = async function (email) {
  return await this.findOne({ email: email.toLowerCase() }).lean();
};
