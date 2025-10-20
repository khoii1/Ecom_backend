import { BaseModel } from './base.model.js';
const tableName = 'password_reset_tokens';
export const PasswordResetTokenModel = {
  findMany: (args={}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  create: ({ user_id, token_hash, purpose, expires_at, used=false }) =>
    BaseModel.insert({ tableName, columns: ['user_id','token_hash','purpose','expires_at','used'], values: [user_id,token_hash,purpose,expires_at,used] }),
  findLatestByPurpose: async (user_id, purpose) => {
    const { databasePool } = await import('../config/database.js');
    const r = await databasePool.query('SELECT * FROM password_reset_tokens WHERE user_id=$1 AND purpose=$2 ORDER BY created_at DESC LIMIT 1', [user_id, purpose]);
    return r.rows[0] || null;
  },
  markUsed: async (id) => {
    const { databasePool } = await import('../config/database.js');
    await databasePool.query('UPDATE password_reset_tokens SET used=true WHERE id=$1', [id]);
    return true;
  },
};
