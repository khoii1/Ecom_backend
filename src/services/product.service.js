import { ProductModel } from "../models/product.model.js";
import { StoreModel } from "../models/store.model.js";
import { CartItemModel } from "../models/cart_item.model.js";
import { ROLES } from "../constants/roles.js";

// Helper functions để chuyển đổi ID thành String cho frontend
const formatProductForFrontend = (product) => {
  if (!product) return product;
  
  // Tính toán final_price
  const finalPrice = ProductModel.calculateFinalPrice(
    product.price,
    product.discount_percentage
  );
  
  // Xử lý backward compatibility: nếu có image_url nhưng chưa có image_urls
  let imageUrls = product.image_urls || [];
  if (product.image_url && !imageUrls.length) {
    imageUrls = [product.image_url];
  }
  
  return {
    ...product,
    id: product._id.toString(),
    store_id: product.store_id?.toString() || product.store_id.toString(),
    category_id: product.category_id ? product.category_id.toString() : null,
    final_price: finalPrice,
    image_urls: imageUrls,
    image_url: imageUrls.length > 0 ? imageUrls[0] : product.image_url, // Giữ backward compatibility
    stock_quantity: product.stock_quantity ?? 0,
  };
};

const formatProductsForFrontend = (products) => {
  if (!Array.isArray(products)) return products;
  return products.map(formatProductForFrontend);
};

export const ProductService = {
  // Lấy tất cả products với final_price và hỗ trợ lọc nâng cao
  list: async (filters = {}) => {
    const query = { status: 'active' };
    
    // Lọc theo category
    if (filters.category_id) {
      query.category_id = filters.category_id;
    }
    
    // Lọc theo store
    if (filters.store_id) {
      query.store_id = filters.store_id;
    }
    
    // Advanced search - tìm kiếm trong title, description
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }
    
    // Lọc theo giá gốc (price)
    if (filters.min_price || filters.max_price) {
      query.price = {};
      if (filters.min_price) {
        query.price.$gte = parseFloat(filters.min_price);
      }
      if (filters.max_price) {
        query.price.$lte = parseFloat(filters.max_price);
      }
    }
    
    // Lọc theo giá sau giảm (final_price) - tính toán qua aggregation
    const needsFinalPriceFilter = filters.min_final_price || filters.max_final_price;
    
    // Lọc theo rating
    if (filters.min_rating) {
      query.rating = { $gte: parseFloat(filters.min_rating) };
    }
    
    // Lọc theo stock quantity
    if (filters.in_stock_only === 'true' || filters.in_stock_only === true) {
      query.$expr = { $gt: [{ $subtract: ['$stock_quantity', '$reserved_quantity'] }, 0] };
    } else if (filters.min_stock !== undefined) {
      query.$expr = {
        $gte: [
          { $subtract: ['$stock_quantity', '$reserved_quantity'] },
          parseInt(filters.min_stock)
        ]
      };
    }
    
    // Lọc theo discount
    if (filters.has_discount === 'true' || filters.has_discount === true) {
      query.discount_percentage = { $gt: 0 };
    } else if (filters.min_discount !== undefined) {
      query.discount_percentage = { $gte: parseFloat(filters.min_discount) };
    }
    
    // Sắp xếp
    const sortOptions = {
      'price_asc': { price: 1 },
      'price_desc': { price: -1 },
      'final_price_asc': { price: 1, discount_percentage: -1 }, // Ưu tiên discount
      'final_price_desc': { price: -1, discount_percentage: -1 },
      'rating_desc': { rating: -1 },
      'rating_asc': { rating: 1 },
      'newest': { createdAt: -1 },
      'oldest': { createdAt: 1 },
      'name_asc': { title: 1 },
      'name_desc': { title: -1 },
      'discount_desc': { discount_percentage: -1 },
      'stock_desc': { stock_quantity: -1 },
    };
    const sort = sortOptions[filters.sort] || { createdAt: -1 };
    
    let products;
    
    // Nếu cần lọc theo final_price, dùng aggregation
    if (needsFinalPriceFilter) {
      const pipeline = [
        { $match: query },
        {
          $addFields: {
            final_price: {
              $cond: {
                if: { $and: [{ $ne: ['$discount_percentage', null] }, { $gt: ['$discount_percentage', 0] }] },
                then: {
                  $subtract: [
                    '$price',
                    { $divide: [{ $multiply: ['$price', '$discount_percentage'] }, 100] }
                  ]
                },
                else: '$price'
              }
            }
          }
        }
      ];
      
      // Thêm filter final_price vào pipeline
      if (filters.min_final_price || filters.max_final_price) {
        const finalPriceFilter = {};
        if (filters.min_final_price) {
          finalPriceFilter.$gte = parseFloat(filters.min_final_price);
        }
        if (filters.max_final_price) {
          finalPriceFilter.$lte = parseFloat(filters.max_final_price);
        }
        pipeline.push({ $match: { final_price: finalPriceFilter } });
      }
      
      // Thêm sort và limit
      pipeline.push({ $sort: sort });
      
      if (filters.limit) {
        pipeline.push({ $limit: parseInt(filters.limit) });
      }
      if (filters.offset) {
        pipeline.push({ $skip: parseInt(filters.offset) });
      }
      
      products = await ProductModel.aggregate(pipeline);
    } else {
      // Không cần final_price filter, dùng find bình thường
      let queryBuilder = ProductModel.find(query);
      
      if (filters.limit) {
        queryBuilder = queryBuilder.limit(parseInt(filters.limit));
      }
      if (filters.offset) {
        queryBuilder = queryBuilder.skip(parseInt(filters.offset));
      }
      
      products = await queryBuilder.sort(sort).lean();
    }
    
    return formatProductsForFrontend(products);
  },

  // Lấy products theo store (cho seller)
  listByStore: async (storeId) => {
    const products = await ProductModel.find({ store_id: storeId }).lean();
    return formatProductsForFrontend(products);
  },

  // Lấy products theo category (cho buyers)
  listByCategory: async (categoryId) => {
    const products = await ProductModel.find({ category_id: categoryId }).lean();
    return formatProductsForFrontend(products);
  },

  // Chi tiết sản phẩm với final_price
  detail: async (id) => {
    const product = await ProductModel.findById(id).lean();
    return formatProductForFrontend(product);
  },

  // Tạo sản phẩm - chỉ owner của store
  async create(currentUser, payload) {
    const store = await StoreModel.findById(payload.store_id).lean();
    if (!store) {
      throw new Error("Không tìm thấy cửa hàng");
    }

    // Kiểm tra ownership
    if (currentUser.role !== ROLES.ADMIN && store.owner_id.toString() !== currentUser.id.toString()) {
      throw new Error("Bạn không có quyền thêm sản phẩm vào cửa hàng này");
    }

    // Validation business logic cho discount_percentage
    if (
      payload.discount_percentage !== null &&
      payload.discount_percentage !== undefined
    ) {
      if (
        Number(payload.discount_percentage) < 0 ||
        Number(payload.discount_percentage) > 100
      ) {
        throw new Error("Phần trăm giảm giá phải từ 0 đến 100");
      }
    }

    const newProduct = await ProductModel.create(payload);
    return formatProductForFrontend(newProduct.toObject());
  },

  // Cập nhật sản phẩm - chỉ owner của store
  async update(currentUser, id, patch) {
    const product = await ProductModel.findById(id).lean();
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Kiểm tra ownership qua store
    if (currentUser.role !== ROLES.ADMIN) {
      const store = await StoreModel.findById(product.store_id).lean();
      if (!store || store.owner_id.toString() !== currentUser.id.toString()) {
        throw new Error("Bạn không có quyền chỉnh sửa sản phẩm này");
      }
    }

    // Validation business logic cho discount_percentage khi update
    if (
      patch.discount_percentage !== null &&
      patch.discount_percentage !== undefined
    ) {
      if (
        Number(patch.discount_percentage) < 0 ||
        Number(patch.discount_percentage) > 100
      ) {
        throw new Error("Phần trăm giảm giá phải từ 0 đến 100");
      }
    }

    const updatedProduct = await ProductModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();
    
    return formatProductForFrontend(updatedProduct);
  },

  // Xóa sản phẩm - chỉ owner của store
  async remove(currentUser, id) {
    const product = await ProductModel.findById(id).lean();
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Kiểm tra ownership qua store
    if (currentUser.role !== ROLES.ADMIN) {
      const store = await StoreModel.findById(product.store_id).lean();
      if (!store || store.owner_id.toString() !== currentUser.id.toString()) {
        throw new Error("Bạn không có quyền xóa sản phẩm này");
      }
    }

    // Xóa tất cả cart items liên quan đến sản phẩm này trước
    await CartItemModel.deleteMany({ product_id: id });

    // Sau đó mới xóa sản phẩm
    await ProductModel.findByIdAndDelete(id);
    return true;
  },
};
