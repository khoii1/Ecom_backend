import { ProductVariantModel } from "../models/product_variant.model.js";
import { ProductModel } from "../models/product.model.js";

export const ProductVariantService = {
  // Lấy tất cả variants của một sản phẩm
  async getProductVariants(product_id) {
    const variants = await ProductVariantModel.find({
      product_id,
      is_active: true,
    }).lean();
    
    return variants.map(v => ({
      ...v,
      id: v._id.toString(),
      product_id: v.product_id.toString(),
    }));
  },
  
  // Lấy variant theo ID
  async getVariantById(variant_id) {
    const variant = await ProductVariantModel.findById(variant_id).lean();
    if (!variant) return null;
    
    return {
      ...variant,
      id: variant._id.toString(),
      product_id: variant.product_id.toString(),
    };
  },
  
  // Tạo variant mới
  async createVariant(product_id, payload, currentUser) {
    // Kiểm tra quyền sở hữu sản phẩm
    const product = await ProductModel.findById(product_id)
      .populate('store_id')
      .lean();
    if (!product) {
      throw new Error("Sản phẩm không tồn tại");
    }
    
    // Kiểm tra quyền ownership: Chỉ owner của store hoặc ADMIN mới được tạo variant
    if (currentUser) {
      const { ROLES } = await import("../constants/roles.js");
      const isAdmin = currentUser.role === ROLES.ADMIN;
      const isOwner = product.store_id && 
        product.store_id.owner_id && 
        product.store_id.owner_id.toString() === currentUser.id.toString();
      
      if (!isAdmin && !isOwner) {
        throw new Error("FORBIDDEN");
      }
    }
    
    const variant = await ProductVariantModel.create({
      product_id,
      ...payload,
    });
    
    return {
      ...variant.toObject(),
      id: variant._id.toString(),
      product_id: variant.product_id.toString(),
    };
  },
  
  // Cập nhật variant
  async updateVariant(variant_id, payload, currentUser) {
    const variant = await ProductVariantModel.findById(variant_id)
      .populate({
        path: 'product_id',
        populate: { path: 'store_id' }
      })
      .lean();
    if (!variant) {
      throw new Error("Biến thể không tồn tại");
    }
    
    // Kiểm tra quyền ownership: Chỉ owner của store hoặc ADMIN mới được cập nhật variant
    if (currentUser) {
      const { ROLES } = await import("../constants/roles.js");
      const isAdmin = currentUser.role === ROLES.ADMIN;
      const product = variant.product_id;
      const isOwner = product && 
        product.store_id && 
        product.store_id.owner_id && 
        product.store_id.owner_id.toString() === currentUser.id.toString();
      
      if (!isAdmin && !isOwner) {
        throw new Error("FORBIDDEN");
      }
    }
    
    const updated = await ProductVariantModel.findByIdAndUpdate(
      variant_id,
      { $set: payload },
      { new: true, runValidators: true }
    ).lean();
    
    return {
      ...updated,
      id: updated._id.toString(),
      product_id: updated.product_id.toString(),
    };
  },
  
  // Xóa variant
  async deleteVariant(variant_id, currentUser) {
    const variant = await ProductVariantModel.findById(variant_id)
      .populate({
        path: 'product_id',
        populate: { path: 'store_id' }
      })
      .lean();
    
    if (!variant) {
      throw new Error("Biến thể không tồn tại");
    }
    
    // Kiểm tra quyền ownership: Chỉ owner của store hoặc ADMIN mới được xóa variant
    if (currentUser) {
      const { ROLES } = await import("../constants/roles.js");
      const isAdmin = currentUser.role === ROLES.ADMIN;
      const product = variant.product_id;
      const isOwner = product && 
        product.store_id && 
        product.store_id.owner_id && 
        product.store_id.owner_id.toString() === currentUser.id.toString();
      
      if (!isAdmin && !isOwner) {
        throw new Error("FORBIDDEN");
      }
    }
    
    // Thay vì xóa, set is_active = false
    const updated = await ProductVariantModel.findByIdAndUpdate(
      variant_id,
      { $set: { is_active: false } },
      { new: true }
    ).lean();
    
    return {
      ...updated,
      id: updated._id.toString(),
      product_id: updated.product_id.toString(),
    };
  },
};

