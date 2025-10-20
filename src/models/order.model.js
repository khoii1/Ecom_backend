import { BaseModel } from './base.model.js';
const tableName = 'orders';
export const OrderModel = {
  findMany: (args={}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  create: ({ code, buyer_id, store_id, subtotal, total, status='pending' }) =>
    BaseModel.insert({ tableName, columns: ['code','buyer_id','store_id','subtotal','total','status'], values: [code,buyer_id,store_id,subtotal,total,status] }),
  updateById: (id, patch) => BaseModel.updateById({ tableName, id, patch }),
  deleteById: (id) => BaseModel.deleteById({ tableName, id }),
};
