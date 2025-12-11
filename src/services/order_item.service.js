import { OrderItemModel } from '../models/order_item.model.js';

const formatOrderItemForFrontend = (item) => {
  if (!item) return item;
  return {
    ...item,
    id: item._id.toString(),
    order_id: item.order_id?.toString() || item.order_id.toString(),
    product_id: item.product_id?.toString() || item.product_id.toString(),
  };
};

const formatOrderItemsForFrontend = (items) => {
  if (!Array.isArray(items)) return items;
  return items.map(formatOrderItemForFrontend);
};

export const OrderItemService = {
  list: async () => {
    const items = await OrderItemModel.find({}).lean();
    return formatOrderItemsForFrontend(items);
  },
  
  detail: async (id) => {
    const item = await OrderItemModel.findById(id).lean();
    return formatOrderItemForFrontend(item);
  },
  
  create: async (_cu, payload) => {
    const item = await OrderItemModel.create(payload);
    return formatOrderItemForFrontend(item.toObject());
  },
  
  update: async (_cu, id, patch) => {
    const item = await OrderItemModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();
    return formatOrderItemForFrontend(item);
  },
  
  remove: async (_cu, id) => {
    await OrderItemModel.findByIdAndDelete(id);
    return true;
  },
};
