import { BaseModel } from './base.model.js';
const tableName = 'users';
export const UserModel = {
  findMany: (args={}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  findByEmail: async (email) => {
    const { databasePool } = await import('../config/database.js');
    const r = await databasePool.query('SELECT * FROM users WHERE email=$1', [email]);
    return r.rows[0] || null;
  },
  create: ({ full_name, email, password_hash, role='USER', status='pending' }) =>
    BaseModel.insert({ tableName, columns: ['full_name','email','password_hash','role','status'], values: [full_name,email,password_hash,role,status] }),
  updateById: (id, patch) => BaseModel.updateById({ tableName, id, patch }),
  deleteById: (id) => BaseModel.deleteById({ tableName, id }),
};
