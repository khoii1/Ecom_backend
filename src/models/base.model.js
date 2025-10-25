import { databasePool } from "../config/database.js";

// --- Danh sách các bảng CÓ cột updated_at ---
const tablesWithUpdatedAt = new Set([
  "users",
  "stores",
  "categories",
  "products",
  "carts",
  "orders",
]);
// --- KẾT THÚC ---

export const BaseModel = {
  async findMany({
    tableName,
    // SỬA: Thay đổi sắp xếp mặc định từ created_at sang id
    orderClause = "ORDER BY id ASC", // <<< SỬA Ở ĐÂY
    // --- KẾT THÚC SỬA ---
    limit = 100,
  }) {
    // Kiểm tra orderClause hợp lệ (đơn giản) để tránh SQL injection cơ bản
    // Trong thực tế có thể cần kiểm tra kỹ hơn
    const safeOrderClause = orderClause.toUpperCase().startsWith("ORDER BY")
      ? orderClause
      : "ORDER BY id ASC";

    const sql = `SELECT * FROM ${tableName} ${safeOrderClause} LIMIT $1`;
    try {
      const r = await databasePool.query(sql, [limit]);
      return r.rows;
    } catch (dbError) {
      console.error(
        `Database error during findMany for ${tableName}:`,
        dbError
      );
      // Ném lại lỗi để controller xử lý
      throw dbError;
    }
  },
  async findById({ tableName, id }) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      console.error(
        `Invalid non-numeric ID passed to findById for ${tableName}: ${id}`
      );
      return null;
    }
    const r = await databasePool.query(
      `SELECT * FROM ${tableName} WHERE id=$1`,
      [numericId]
    );
    return r.rows[0] || null;
  },
  async insert({ tableName, columns, values }) {
    const cols = columns.join(", ");
    const ph = values.map((_, i) => `$${i + 1}`).join(", ");
    try {
      const r = await databasePool.query(
        `INSERT INTO ${tableName}(${cols}) VALUES(${ph}) RETURNING *`,
        values
      );
      return r.rows[0];
    } catch (dbError) {
      console.error(`Database error during insert for ${tableName}:`, dbError);
      throw dbError;
    }
  },
  async updateById({ tableName, id, patch }) {
    const keys = Object.keys(patch);
    if (!keys.length) return this.findById({ tableName, id });

    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      console.error(
        `Invalid non-numeric ID passed to updateById for ${tableName}: ${id}`
      );
      throw new Error(`ID không hợp lệ cho bảng ${tableName}`);
    }

    const setClause = keys.map((k, i) => `${k}=$${i + 1}`).join(", ");
    const finalSetClause = tablesWithUpdatedAt.has(tableName)
      ? `${setClause}, updated_at=NOW()`
      : setClause;

    try {
      const sql = `UPDATE ${tableName} SET ${finalSetClause} WHERE id=$${
        keys.length + 1
      } RETURNING *`;
      const r = await databasePool.query(sql, [
        ...keys.map((k) => patch[k]),
        numericId,
      ]);
      return r.rows[0] || null;
    } catch (dbError) {
      console.error(
        `Database error during updateById for ${tableName} (ID: ${id}):`,
        dbError
      );
      throw dbError;
    }
  },
  async deleteById({ tableName, id }) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      console.error(
        `Invalid non-numeric ID passed to deleteById for ${tableName}: ${id}`
      );
      throw new Error(`ID không hợp lệ cho bảng ${tableName}`);
    }
    try {
      await databasePool.query(`DELETE FROM ${tableName} WHERE id=$1`, [
        numericId,
      ]);
      return true;
    } catch (dbError) {
      console.error(
        `Database error during deleteById for ${tableName} (ID: ${id}):`,
        dbError
      );
      throw dbError;
    }
  },
  async findOne({ tableName, ...conditions }) {
    const keys = Object.keys(conditions);
    if (!keys.length) return null;

    const whereClause = keys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(" AND ");
    const values = keys.map((key) => conditions[key]);

    const finalValues = values.map((val, index) => {
      const key = keys[index];
      if (key === "id" || key.endsWith("_id")) {
        const numVal = parseInt(val, 10);
        if (!isNaN(numVal)) {
          return numVal;
        } else {
          console.warn(
            `Invalid numeric value for condition ${key}=${val} in findOne for ${tableName}.`
          );
          return val;
        }
      }
      return val;
    });

    try {
      const r = await databasePool.query(
        `SELECT * FROM ${tableName} WHERE ${whereClause} LIMIT 1`,
        finalValues
      );
      return r.rows[0] || null;
    } catch (dbError) {
      console.error(
        `Database error during findOne for ${tableName} with conditions ${JSON.stringify(
          conditions
        )}:`,
        dbError
      );
      throw dbError;
    }
  },
};
