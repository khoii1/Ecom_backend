import { UserModel } from "../models/user.model.js";
import { hashPassword } from "../utils/crypto.js";

export const UserService = {
  list: async (role) => {
    const query = {};
    if (role) {
      query.role = role;
    }
    const users = await UserModel.find(query).lean();
    return users.map((u) => ({
      ...u,
      id: u._id.toString(),
    }));
  },

  detail: async (id) => {
    const user = await UserModel.findById(id).lean();
    if (!user) return null;
    return {
      ...user,
      id: user._id.toString(),
    };
  },

  async create(_cu, payload) {
    const password_hash = await hashPassword(payload.password);
    const user = await UserModel.create({
      full_name: payload.full_name,
      email: payload.email,
      password_hash,
      role: payload.role || "USER",
      status: payload.status || "active",
    });
    return {
      ...user.toObject(),
      id: user._id.toString(),
    };
  },

  update: async (_cu, id, patch) => {
    const user = await UserModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();
    if (!user) return null;
    return {
      ...user,
      id: user._id.toString(),
    };
  },

  remove: async (_cu, id) => {
    await UserModel.findByIdAndDelete(id);
    return true;
  },
};
