import { CategoryModel } from "../models/category.model.js";
import slugify from "slugify";

export const CategoryService = {
  list: () => CategoryModel.findMany({}),
  detail: (id) => CategoryModel.findById(id),
  create: (_cu, payload) => {
    const slug =
      payload.slug || slugify(payload.name, { lower: true, strict: true });
    return CategoryModel.create({ ...payload, slug });
  },
  update: (_cu, id, patch) => CategoryModel.updateById(id, patch),
  remove: (_cu, id) => CategoryModel.deleteById(id),
};
