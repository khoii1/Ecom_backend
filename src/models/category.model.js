import { BaseModel } from './base.model.js';
const tableName = 'categories';
export const CategoryModel = {
  findMany: (args={}) => BaseModel.findMany({ tableName, ...args }),
  findById: (id) => BaseModel.findById({ tableName, id }),
  create: ({ name, slug, parent_id=null }) =>
    BaseModel.insert({ tableName, columns: ['name','slug','parent_id'], values: [name,slug,parent_id] }),
  updateById: (id, patch) => BaseModel.updateById({ tableName, id, patch }),
  deleteById: (id) => BaseModel.deleteById({ tableName, id }),
};
