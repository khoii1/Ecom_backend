import { StoreModel } from "../models/store.model.js";
import { ROLES } from "../constants/roles.js";

const formatStoreForFrontend = (store) => {
  if (!store) return store;
  return {
    ...store,
    id: store._id.toString(),
    owner_id: store.owner_id?.toString() || store.owner_id.toString(),
  };
};

const formatStoresForFrontend = (stores) => {
  if (!Array.isArray(stores)) return stores;
  return stores.map(formatStoreForFrontend);
};

export const StoreService = {
  // Lấy tất cả stores
  list: async () => {
    const stores = await StoreModel.find({}).lean();
    return formatStoresForFrontend(stores);
  },

  // Lấy stores của user hiện tại (cho seller)
  listByOwner: async (ownerId) => {
    const stores = await StoreModel.find({ owner_id: ownerId }).lean();
    return formatStoresForFrontend(stores);
  },

  // Chi tiết store
  detail: async (id) => {
    const store = await StoreModel.findById(id).lean();
    if (!store) return null;
    
    // Tính rating trung bình từ reviews của các sản phẩm trong store
    const { ReviewModel } = await import("../models/review.model.js");
    const { ProductModel } = await import("../models/product.model.js");
    const mongoose = (await import("../config/database.js")).mongoose;
    const ObjectId = mongoose.Types.ObjectId;
    
    const storeObjectId = new ObjectId(id);
    
    // Lấy tất cả product IDs của store
    const products = await ProductModel.find({ store_id: storeObjectId }).select('_id').lean();
    const productIds = products.map(p => p._id);
    
    let averageRating = 0;
    if (productIds.length > 0) {
      const reviewsResult = await ReviewModel.aggregate([
        {
          $match: {
            product_id: { $in: productIds }
          }
        },
        {
          $group: {
            _id: null,
            average_rating: { $avg: "$rating" },
            total_reviews: { $sum: 1 }
          }
        }
      ]);
      
      if (reviewsResult.length > 0 && reviewsResult[0].average_rating) {
        averageRating = Math.round(reviewsResult[0].average_rating * 10) / 10;
      }
    }
    
    const formattedStore = formatStoreForFrontend(store);
    formattedStore.average_rating = averageRating;
    
    return formattedStore;
  },

  // Tạo store
  async create(currentUser, payload) {
    const owner_id =
      currentUser.role === ROLES.ADMIN && payload.owner_id
        ? payload.owner_id
        : currentUser.id;

    const newStore = await StoreModel.create({
      owner_id,
      name: payload.name,
      status: payload.status || "active",
    });
    
    return formatStoreForFrontend(newStore.toObject());
  },

  // Cập nhật store - chỉ owner hoặc admin
  async update(currentUser, id, patch) {
    const store = await StoreModel.findById(id).lean();
    if (!store) {
      throw new Error("Không tìm thấy cửa hàng");
    }

    if (currentUser.role !== ROLES.ADMIN && store.owner_id.toString() !== currentUser.id.toString()) {
      throw new Error("Bạn không có quyền chỉnh sửa cửa hàng này");
    }

    const updatedStore = await StoreModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();
    
    return formatStoreForFrontend(updatedStore);
  },

  // Xóa store - chỉ owner hoặc admin
  async remove(currentUser, id) {
    const store = await StoreModel.findById(id).lean();
    if (!store) {
      throw new Error("Không tìm thấy cửa hàng");
    }

    if (currentUser.role !== ROLES.ADMIN && store.owner_id.toString() !== currentUser.id.toString()) {
      throw new Error("Bạn không có quyền xóa cửa hàng này");
    }

    await StoreModel.findByIdAndDelete(id);
    return true;
  },
};
