import { AddressService } from "../services/address.service.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";

export const AddressController = {
  getMyAddresses: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.debug('ADDRESS', 'Lấy danh sách địa chỉ', { userId });
    const addresses = await AddressService.getMyAddresses(userId);
    logger.info('ADDRESS', `Trả về ${addresses.length} địa chỉ`, { userId });
    res.json(addresses);
  }),

  getDefault: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.debug('ADDRESS', 'Lấy địa chỉ mặc định', { userId });
    const address = await AddressService.getDefaultAddress(userId);
    if (!address) {
      return res.status(404).json({ message: "Không tìm thấy địa chỉ mặc định" });
    }
    res.json(address);
  }),

  getById: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const addressId = req.params.addressId;
    logger.debug('ADDRESS', 'Lấy địa chỉ theo ID', { userId, addressId });
    const address = await AddressService.getAddressById(addressId, userId);
    if (!address) {
      return res.status(404).json({ message: "Địa chỉ không tồn tại" });
    }
    res.json(address);
  }),

  create: handle(async (req, res) => {
    const userId = req.currentUser.id;
    logger.info('ADDRESS', 'Tạo địa chỉ mới', { userId });
    const address = await AddressService.createAddress(userId, req.body);
    logger.info('ADDRESS', 'Tạo địa chỉ thành công', { userId, addressId: address.id });
    res.status(201).json(address);
  }),

  update: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const addressId = req.params.addressId;
    logger.info('ADDRESS', 'Cập nhật địa chỉ', { userId, addressId });
    const address = await AddressService.updateAddress(addressId, userId, req.body);
    logger.info('ADDRESS', 'Cập nhật địa chỉ thành công', { userId, addressId });
    res.json(address);
  }),

  delete: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const addressId = req.params.addressId;
    logger.info('ADDRESS', 'Xóa địa chỉ', { userId, addressId });
    await AddressService.deleteAddress(addressId, userId);
    logger.info('ADDRESS', 'Xóa địa chỉ thành công', { userId, addressId });
    res.json({ message: "Đã xóa địa chỉ" });
  }),

  setDefault: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const addressId = req.params.addressId;
    logger.info('ADDRESS', 'Set địa chỉ làm mặc định', { userId, addressId });
    const address = await AddressService.setDefaultAddress(addressId, userId);
    logger.info('ADDRESS', 'Set mặc định thành công', { userId, addressId });
    res.json(address);
  }),
};

