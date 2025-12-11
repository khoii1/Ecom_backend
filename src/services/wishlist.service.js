import { WishlistModel } from "../models/wishlist.model.js";
import { ProductModel } from "../models/product.model.js";

export const WishlistService = {
  // Lấy danh sách wishlist của user
  async getMyWishlist(user_id) {
    const wishlistItems = await WishlistModel.find({ user_id })
      .populate({
        path: 'product_id',
        match: { status: 'active' },
      })
      .sort({ createdAt: -1 })
      .lean();
    
    // Helper function để format product
    const formatProduct = (product) => {
      if (!product) return null;
      const price = parseFloat(product.price);
      const discount = parseFloat(product.discount_percentage || 0);
      const finalPrice = discount > 0 
        ? price - (price * discount) / 100 
        : price;
      
      return {
        ...product,
        id: product._id.toString(),
        store_id: product.store_id?.toString(),
        category_id: product.category_id?.toString() || null,
        final_price: finalPrice,
      };
    };
    
    // Lọc bỏ các sản phẩm đã bị xóa hoặc inactive
    const validItems = wishlistItems
      .filter(item => item.product_id)
      .map(item => formatProduct(item.product_id))
      .filter(Boolean);
    
    return validItems;
  },
  
  // Kiểm tra sản phẩm có trong wishlist không
  async isInWishlist(user_id, product_id) {
    const item = await WishlistModel.findOne({
      user_id,
      product_id,
    }).lean();
    
    return !!item;
  },
  
  // Thêm sản phẩm vào wishlist
  async addToWishlist(user_id, product_id) {
    // Kiểm tra sản phẩm tồn tại
    const product = await ProductModel.findById(product_id).lean();
    if (!product) {
      throw new Error("Sản phẩm không tồn tại");
    }
    
    // Kiểm tra đã có trong wishlist chưa
    const existed = await WishlistModel.findOne({
      user_id,
      product_id,
    }).lean();
    
    if (existed) {
      throw new Error("Sản phẩm đã có trong danh sách yêu thích");
    }
    
    // Thêm vào wishlist
    const newItem = await WishlistModel.create({
      user_id,
      product_id,
    });
    
    return newItem.toObject();
  },
  
  // Xóa sản phẩm khỏi wishlist
  async removeFromWishlist(user_id, product_id) {
    const deleted = await WishlistModel.findOneAndDelete({
      user_id,
      product_id,
    }).lean();
    
    if (!deleted) {
      throw new Error("Sản phẩm không có trong danh sách yêu thích");
    }
    
    return true;
  },
  
  // Xóa tất cả khỏi wishlist
  async clearWishlist(user_id) {
    await WishlistModel.deleteMany({ user_id });
    return true;
  },
};

