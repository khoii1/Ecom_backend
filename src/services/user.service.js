import { UserModel } from '../models/user.model.js';
import { hashPassword } from '../utils/crypto.js';

export const UserService = {
  list: () => UserModel.findMany({}),
  detail: (id) => UserModel.findById(id),
  async create(_cu, payload) {
    const password_hash = await hashPassword(payload.password);
    return UserModel.create({ full_name: payload.full_name, email: payload.email, password_hash, role: payload.role || 'USER', status: payload.status || 'active' });
  },
  update: (_cu, id, patch) => UserModel.updateById(id, patch),
  remove: (_cu, id) => UserModel.deleteById(id),
};
