import { BaseModel } from './base.model.js';
const tableName = 'stores';
export const StoreModel = {
  findMany: (args={}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  create: ({ owner_id, name, slug, status='active' }) =>
    BaseModel.insert({ tableName, columns: ['owner_id','name','slug','status'], values: [owner_id,name,slug,status] }),
  updateById: (id, patch) => BaseModel.updateById({ tableName, id, patch }),
  deleteById: (id) => BaseModel.deleteById({ tableName, id }),
};
