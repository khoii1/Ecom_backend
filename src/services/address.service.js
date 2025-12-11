import { AddressModel } from "../models/address.model.js";

export const AddressService = {
  // Lấy tất cả địa chỉ của user
  async getMyAddresses(user_id) {
    const addresses = await AddressModel.find({ user_id })
      .sort({ is_default: -1, createdAt: -1 })
      .lean();
    
    return addresses.map(addr => ({
      ...addr,
      id: addr._id.toString(),
      user_id: addr.user_id.toString(),
    }));
  },
  
  // Lấy địa chỉ mặc định
  async getDefaultAddress(user_id) {
    const address = await AddressModel.findOne({
      user_id,
      is_default: true,
    }).lean();
    
    if (!address) return null;
    
    return {
      ...address,
      id: address._id.toString(),
      user_id: address.user_id.toString(),
    };
  },
  
  // Lấy địa chỉ theo ID
  async getAddressById(address_id, user_id) {
    const address = await AddressModel.findOne({
      _id: address_id,
      user_id,
    }).lean();
    
    if (!address) return null;
    
    return {
      ...address,
      id: address._id.toString(),
      user_id: address.user_id.toString(),
    };
  },
  
  // Tạo địa chỉ mới
  async createAddress(user_id, payload) {
    // Nếu set làm default, bỏ default của các address khác
    if (payload.is_default) {
      await AddressModel.updateMany(
        { user_id },
        { $set: { is_default: false } }
      );
    }
    
    // Nếu đây là địa chỉ đầu tiên, tự động set làm default
    const addressCount = await AddressModel.countDocuments({ user_id });
    if (addressCount === 0) {
      payload.is_default = true;
    }
    
    const newAddress = await AddressModel.create({
      user_id,
      ...payload,
    });
    
    return {
      ...newAddress.toObject(),
      id: newAddress._id.toString(),
      user_id: newAddress.user_id.toString(),
    };
  },
  
  // Cập nhật địa chỉ
  async updateAddress(address_id, user_id, payload) {
    // Kiểm tra quyền sở hữu
    const address = await AddressModel.findOne({
      _id: address_id,
      user_id,
    }).lean();
    
    if (!address) {
      throw new Error("Địa chỉ không tồn tại hoặc không thuộc về bạn");
    }
    
    // Nếu set làm default, bỏ default của các address khác
    if (payload.is_default) {
      await AddressModel.updateMany(
        { user_id, _id: { $ne: address_id } },
        { $set: { is_default: false } }
      );
    }
    
    const updatedAddress = await AddressModel.findByIdAndUpdate(
      address_id,
      { $set: payload },
      { new: true, runValidators: true }
    ).lean();
    
    return {
      ...updatedAddress,
      id: updatedAddress._id.toString(),
      user_id: updatedAddress.user_id.toString(),
    };
  },
  
  // Xóa địa chỉ
  async deleteAddress(address_id, user_id) {
    const address = await AddressModel.findOne({
      _id: address_id,
      user_id,
    }).lean();
    
    if (!address) {
      throw new Error("Địa chỉ không tồn tại hoặc không thuộc về bạn");
    }
    
    await AddressModel.findByIdAndDelete(address_id);
    return true;
  },
  
  // Set địa chỉ làm mặc định
  async setDefaultAddress(address_id, user_id) {
    // Kiểm tra quyền sở hữu
    const address = await AddressModel.findOne({
      _id: address_id,
      user_id,
    }).lean();
    
    if (!address) {
      throw new Error("Địa chỉ không tồn tại hoặc không thuộc về bạn");
    }
    
    // Bỏ default của tất cả address khác
    await AddressModel.updateMany(
      { user_id, _id: { $ne: address_id } },
      { $set: { is_default: false } }
    );
    
    // Set address này làm default
    const updatedAddress = await AddressModel.findByIdAndUpdate(
      address_id,
      { $set: { is_default: true } },
      { new: true }
    ).lean();
    
    return {
      ...updatedAddress,
      id: updatedAddress._id.toString(),
      user_id: updatedAddress.user_id.toString(),
    };
  },
};

