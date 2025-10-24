import { BaseModel } from "./base.model.js";
import { databasePool } from "../config/database.js";

const tableName = "stores";
export const StoreModel = {
  findMany: (args = {}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  findOne: (conditions) => BaseModel.findOne({ tableName, ...conditions }),
  create: ({ owner_id, name, status = "active" }) =>
    BaseModel.insert({
      tableName,
      columns: ["owner_id", "name", "status"],
      values: [owner_id, name, status],
    }),
  updateById: (id, patch) => BaseModel.updateById({ tableName, id, patch }),
  deleteById: (id) => BaseModel.deleteById({ tableName, id }),

  findByOwnerId: async (ownerId) => {
    const r = await databasePool.query(
      `SELECT * FROM ${tableName} WHERE owner_id = $1 ORDER BY created_at DESC`,
      [ownerId]
    );
    return r.rows;
  },
};
