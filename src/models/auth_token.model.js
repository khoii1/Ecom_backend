import { BaseModel } from './base.model.js';
const tableName = 'auth_tokens';
export const AuthTokenModel = {
  findMany: (args={}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  findByUserAndHash: async (user_id, hash) => {
    const { databasePool } = await import('../config/database.js');
    const r = await databasePool.query('SELECT * FROM auth_tokens WHERE user_id=$1 AND refresh_token_hash=$2 AND expires_at>NOW()', [user_id, hash]);
    return r.rows[0] || null;
  },
  create: ({ user_id, refresh_token_hash, expires_at }) =>
    BaseModel.insert({ tableName, columns: ['user_id','refresh_token_hash','expires_at'], values: [user_id,refresh_token_hash,expires_at] }),
  deleteById: (id) => BaseModel.deleteById({ tableName, id }),
  deleteByHash: async (hash) => {
    const { databasePool } = await import('../config/database.js');
    await databasePool.query('DELETE FROM auth_tokens WHERE refresh_token_hash=$1', [hash]);
    return true;
  },
  deleteByUser: async (user_id) => {
    const { databasePool } = await import('../config/database.js');
    await databasePool.query('DELETE FROM auth_tokens WHERE user_id=$1', [user_id]);
    return true;
  },
};
