import { BaseModel } from '../models/base.model.js';
export function createSimpleService(tableName) {
  return {
    list: () => BaseModel.findMany({ tableName }),
    detail: (id) => BaseModel.findById({ tableName, id }),
    create: (_cu, payload) => {
      const columns = Object.keys(payload);
      const values = columns.map(k => payload[k]);
      return BaseModel.insert({ tableName, columns, values });
    },
    update: (_cu, id, patch) => BaseModel.updateById({ tableName, id, patch }),
    remove: (_cu, id) => BaseModel.deleteById({ tableName, id }),
  };
}
