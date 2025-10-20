import { BaseModel } from './base.model.js';
const tableName = 'order_items';
export const OrderItemModel = {
  findMany: (args={}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  create: ({ order_id, product_id, variant_id=null, unit_price, qty }) =>
    BaseModel.insert({ tableName, columns: ['order_id','product_id','variant_id','unit_price','qty'], values: [order_id,product_id,variant_id,unit_price,qty] }),
  updateById: (id, patch) => BaseModel.updateById({ tableName, id, patch }),
  deleteById: (id) => BaseModel.deleteById({ tableName, id }),
};
