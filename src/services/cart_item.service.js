import { CartItemModel } from '../models/cart_item.model.js';

const formatCartItemForFrontend = (item) => {
  if (!item) return item;
  return {
    ...item,
    id: item._id.toString(),
    cart_id: item.cart_id?.toString() || item.cart_id.toString(),
    product_id: item.product_id?.toString() || item.product_id.toString(),
  };
};

const formatCartItemsForFrontend = (items) => {
  if (!Array.isArray(items)) return items;
  return items.map(formatCartItemForFrontend);
};

export const CartItemService = {
  list: async () => {
    const items = await CartItemModel.find({}).lean();
    return formatCartItemsForFrontend(items);
  },
  
  detail: async (id) => {
    const item = await CartItemModel.findById(id).lean();
    return formatCartItemForFrontend(item);
  },
  
  create: async (_cu, payload) => {
    const item = await CartItemModel.create(payload);
    return formatCartItemForFrontend(item.toObject());
  },
  
  update: async (_cu, id, patch) => {
    const item = await CartItemModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();
    return formatCartItemForFrontend(item);
  },
  
  remove: async (_cu, id) => {
    await CartItemModel.findByIdAndDelete(id);
    return true;
  },
};
