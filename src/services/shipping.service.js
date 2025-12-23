import { ShippingModel } from "../models/shipping.model.js";
import { logger } from "../utils/logger.js";

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export const ShippingService = {
  /**
   * Tính phí vận chuyển
   * @param {string} shippingCode - Mã phương thức vận chuyển
   * @param {Object} params - Thông tin tính phí
   * @param {Object} params.origin - Điểm đi {lat, lon, address}
   * @param {Object} params.destination - Điểm đến {lat, lon, address}
   * @param {number} params.weight - Trọng lượng (kg)
   * @param {number} params.totalValue - Tổng giá trị đơn hàng
   */
  async calculateShippingFee(shippingCode, params) {
    const { origin, destination, weight = 1, totalValue = 0 } = params;

    const shipping = await ShippingModel.findOne({
      code: shippingCode.toUpperCase(),
      is_active: true,
    }).lean();

    if (!shipping) {
      throw new Error(`Phương thức vận chuyển ${shippingCode} không tồn tại`);
    }

    // Kiểm tra trọng lượng tối đa
    if (shipping.max_weight_kg && weight > shipping.max_weight_kg) {
      throw new Error(
        `Trọng lượng vượt quá giới hạn (tối đa ${shipping.max_weight_kg}kg)`
      );
    }

    let distance = 0;
    
    // Tính khoảng cách nếu có tọa độ
    if (origin?.lat && origin?.lon && destination?.lat && destination?.lon) {
      distance = calculateDistance(
        origin.lat,
        origin.lon,
        destination.lat,
        destination.lon
      );
    } else {
      // Nếu không có tọa độ, ước tính khoảng cách dựa trên địa chỉ (mặc định 10km)
      distance = 10;
      logger.warn('SHIPPING', 'Không có tọa độ, sử dụng khoảng cách mặc định 10km');
    }

    // Tính phí: base_price + (distance * price_per_km) + (weight * price_per_kg)
    let fee = shipping.base_price;
    
    if (shipping.price_per_km > 0) {
      fee += distance * shipping.price_per_km;
    }
    
    if (shipping.price_per_kg > 0) {
      fee += weight * shipping.price_per_kg;
    }

    // Làm tròn đến hàng nghìn
    fee = Math.ceil(fee / 1000) * 1000;

    return {
      shipping_code: shipping.code,
      shipping_name: shipping.name,
      base_price: shipping.base_price,
      distance_km: Math.round(distance * 10) / 10,
      weight_kg: weight,
      calculated_fee: fee,
      estimated_days: shipping.estimated_days,
      description: shipping.description,
    };
  },

  /**
   * Tính phí vận chuyển cho nhiều phương thức
   */
  async calculateMultipleShippingFees(params) {
    const shippingMethods = await ShippingModel.find({
      is_active: true,
    }).lean();

    const results = [];

    for (const shipping of shippingMethods) {
      try {
        const fee = await this.calculateShippingFee(shipping.code, params);
        results.push(fee);
      } catch (error) {
        logger.warn('SHIPPING', `Không thể tính phí cho ${shipping.code}: ${error.message}`);
        // Skip this shipping method if calculation fails
      }
    }

    return results;
  },

  /**
   * Lấy danh sách phương thức vận chuyển
   */
  async getAllShippingMethods(includeInactive = false) {
    const query = includeInactive ? {} : { is_active: true };
    const methods = await ShippingModel.find(query)
      .sort({ base_price: 1 })
      .lean();

    return methods.map((method) => ({
      id: method._id.toString(),
      code: method.code,
      name: method.name,
      description: method.description,
      base_cost: method.base_price,
      cost_per_km: method.price_per_km,
      cost_per_kg: method.price_per_kg,
      min_weight: null,
      max_weight: method.max_weight_kg,
      max_distance: null,
      estimated_delivery_time: method.estimated_days,
      is_active: method.is_active,
    }));
  },

  /**
   * Tạo phương thức vận chuyển mới
   */
  async createShippingMethod(data) {
    const {
      code,
      name,
      description,
      base_cost,
      cost_per_km,
      cost_per_kg,
      min_weight,
      max_weight,
      max_distance,
      estimated_delivery_time,
      is_active = true,
    } = data;

    if (!code || !name || base_cost === undefined) {
      throw new Error('code, name và base_cost là bắt buộc');
    }

    const existing = await ShippingModel.findOne({ code: code.toUpperCase() });
    if (existing) {
      throw new Error('Mã phương thức vận chuyển đã tồn tại');
    }

    const method = await ShippingModel.create({
      code: code.toUpperCase(),
      name,
      description: description || null,
      base_price: base_cost,
      price_per_km: cost_per_km || 0,
      price_per_kg: cost_per_kg || 0,
      max_weight_kg: max_weight || null,
      estimated_days: estimated_delivery_time || null,
      is_active,
    });

    return {
      id: method._id.toString(),
      code: method.code,
      name: method.name,
      description: method.description,
      base_cost: method.base_price,
      cost_per_km: method.price_per_km,
      cost_per_kg: method.price_per_kg,
      min_weight: null,
      max_weight: method.max_weight_kg,
      max_distance: null,
      estimated_delivery_time: method.estimated_days,
      is_active: method.is_active,
    };
  },

  /**
   * Cập nhật phương thức vận chuyển
   */
  async updateShippingMethod(id, data) {
    const method = await ShippingModel.findById(id);
    if (!method) {
      throw new Error('Phương thức vận chuyển không tồn tại');
    }

    const {
      code,
      name,
      description,
      base_cost,
      cost_per_km,
      cost_per_kg,
      min_weight,
      max_weight,
      max_distance,
      estimated_delivery_time,
      is_active,
    } = data;

    if (code && code.toUpperCase() !== method.code) {
      const existing = await ShippingModel.findOne({ code: code.toUpperCase() });
      if (existing) {
        throw new Error('Mã phương thức vận chuyển đã tồn tại');
      }
      method.code = code.toUpperCase();
    }

    if (name !== undefined) method.name = name;
    if (description !== undefined) method.description = description || null;
    if (base_cost !== undefined) method.base_price = base_cost;
    if (cost_per_km !== undefined) method.price_per_km = cost_per_km || 0;
    if (cost_per_kg !== undefined) method.price_per_kg = cost_per_kg || 0;
    if (max_weight !== undefined) method.max_weight_kg = max_weight || null;
    if (estimated_delivery_time !== undefined) method.estimated_days = estimated_delivery_time || null;
    if (is_active !== undefined) method.is_active = is_active;

    await method.save();

    return {
      id: method._id.toString(),
      code: method.code,
      name: method.name,
      description: method.description,
      base_cost: method.base_price,
      cost_per_km: method.price_per_km,
      cost_per_kg: method.price_per_kg,
      min_weight: null,
      max_weight: method.max_weight_kg,
      max_distance: null,
      estimated_delivery_time: method.estimated_days,
      is_active: method.is_active,
    };
  },

  /**
   * Xóa phương thức vận chuyển
   */
  async deleteShippingMethod(id) {
    const method = await ShippingModel.findById(id);
    if (!method) {
      throw new Error('Phương thức vận chuyển không tồn tại');
    }

    await ShippingModel.findByIdAndDelete(id);
    return true;
  },
};

