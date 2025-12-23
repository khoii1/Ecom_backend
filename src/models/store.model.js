import { mongoose } from "../config/database.js";

const storeSchema = new mongoose.Schema(
  {
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    // Địa chỉ cửa hàng (đầy đủ)
    address: {
      type: String,
      default: null,
      trim: true,
    },
    // Tỉnh/Thành phố
    province: {
      type: String,
      default: null,
      trim: true,
    },
    // Quận/Huyện
    district: {
      type: String,
      default: null,
      trim: true,
    },
    // Phường/Xã
    ward: {
      type: String,
      default: null,
      trim: true,
    },
    // Địa chỉ cụ thể (số nhà, tên đường)
    street: {
      type: String,
      default: null,
      trim: true,
    },
    // Số điện thoại cửa hàng
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    // Mô tả cửa hàng
    description: {
      type: String,
      default: null,
      trim: true,
    },
    // Tọa độ địa lý (latitude, longitude) để tính khoảng cách vận chuyển
    lat: {
      type: Number,
      default: null,
    },
    lon: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
storeSchema.index({ owner_id: 1 });
storeSchema.index({ status: 1 });

export const StoreModel = mongoose.model("Store", storeSchema);
