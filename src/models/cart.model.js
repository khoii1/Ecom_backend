import { BaseModel } from './base.model.js';
const tableName = 'carts';
export const CartModel = {
  findMany: (args={}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  findByUserId: async (user_id) => {
    const { databasePool } = await import('../config/database.js');
    const r = await databasePool.query('SELECT * FROM carts WHERE user_id=$1', [user_id]);
    return r.rows[0] || null;
  },
  create: ({ user_id }) => BaseModel.insert({ tableName, columns: ['user_id'], values: [user_id] }),
  updateById: (id, patch) => BaseModel.updateById({ tableName, id, patch }),
  deleteById: (id) => BaseModel.deleteById({ tableName, id }),
};
