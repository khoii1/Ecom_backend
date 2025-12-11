import { PasswordResetTokenModel } from '../models/password_reset_token.model.js';

export const PasswordResetTokenService = {
  list: async () => {
    const tokens = await PasswordResetTokenModel.find({}).sort({ createdAt: -1 }).lean();
    return tokens.map(t => ({
      ...t,
      id: t._id.toString(),
      user_id: t.user_id.toString(),
    }));
  },
  
  detail: async (id) => {
    const token = await PasswordResetTokenModel.findById(id).lean();
    if (!token) return null;
    return {
      ...token,
      id: token._id.toString(),
      user_id: token.user_id.toString(),
    };
  },
  
  create: async (_cu, payload) => {
    const token = await PasswordResetTokenModel.create(payload);
    return {
      ...token.toObject(),
      id: token._id.toString(),
      user_id: token.user_id.toString(),
    };
  },
  
  update: async (_cu, id, patch) => {
    const token = await PasswordResetTokenModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();
    if (!token) return null;
    return {
      ...token,
      id: token._id.toString(),
      user_id: token.user_id.toString(),
    };
  },
  
  remove: async (_cu, id) => {
    await PasswordResetTokenModel.findByIdAndDelete(id);
    return true;
  },
};
