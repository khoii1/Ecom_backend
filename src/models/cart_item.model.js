import { BaseModel } from './base.model.js';
const tableName = 'cart_items';
export const CartItemModel = {
  findMany: (args={}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  findByCartAndProduct: async (cart_id, product_id) => {
    const { databasePool } = await import('../config/database.js');
    const r = await databasePool.query('SELECT * FROM cart_items WHERE cart_id=$1 AND product_id=$2', [cart_id, product_id]);
    return r.rows[0] || null;
  },
  create: ({ cart_id, product_id, variant_id=null, qty }) =>
    BaseModel.insert({ tableName, columns: ['cart_id','product_id','variant_id','qty'], values: [cart_id,product_id,variant_id,qty] }),
  updateById: (id, patch) => BaseModel.updateById({ tableName, id, patch }),
  deleteById: (id) => BaseModel.deleteById({ tableName, id }),
};
