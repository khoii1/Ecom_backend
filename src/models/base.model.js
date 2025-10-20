import { databasePool } from '../config/database.js';

export const BaseModel = {
  async findMany({ tableName, orderClause = 'ORDER BY created_at DESC', limit = 100 }) {
    const sql = `SELECT * FROM ${tableName} ${orderClause} LIMIT $1`;
    const r = await databasePool.query(sql, [limit]);
    return r.rows;
  },
  async findById({ tableName, id }) {
    const r = await databasePool.query(`SELECT * FROM ${tableName} WHERE id=$1`, [id]);
    return r.rows[0] || null;
  },
  async insert({ tableName, columns, values }) {
    const cols = columns.join(', ');
    const ph = values.map((_, i) => `$${i + 1}`).join(', ');
    const r = await databasePool.query(`INSERT INTO ${tableName}(${cols}) VALUES(${ph}) RETURNING *`, values);
    return r.rows[0];
  },
  async updateById({ tableName, id, patch }) {
    const keys = Object.keys(patch);
    if (!keys.length) return this.findById({ tableName, id });
    const set = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
    const r = await databasePool.query(
      `UPDATE ${tableName} SET ${set}, updated_at=NOW() WHERE id=$${keys.length + 1} RETURNING *`,
      [...keys.map(k => patch[k]), id]
    );
    return r.rows[0] || null;
  },
  async deleteById({ tableName, id }) {
    await databasePool.query(`DELETE FROM ${tableName} WHERE id=$1`, [id]);
    return true;
  },
};
