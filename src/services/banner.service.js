import { BannerModel } from '../models/banner.model.js';

const formatBannerForFrontend = (banner) => {
  if (!banner) return banner;

  // Xử lý cả Mongoose document và plain object (từ .lean())
  const bannerObj = banner.toObject ? banner.toObject() : banner;

  return {
    ...bannerObj,
    id: bannerObj._id?.toString() || bannerObj.id,
    created_by: bannerObj.created_by?.toString() || bannerObj.created_by || null,
  };
};

const formatBannersForFrontend = (banners) => {
  if (!Array.isArray(banners)) return banners;
  return banners.map(formatBannerForFrontend);
};

export const BannerService = {
  // Lấy tất cả banners
  list: async (filters = {}) => {
    const query = {};

    // Lọc theo position
    if (filters.position) {
      query.position = filters.position;
    }

    // Lọc theo trạng thái active (cho public API)
    if (filters.active_only !== undefined) {
      query.is_active = filters.active_only === true || filters.active_only === 'true';
    }

    // Lọc theo ngày hiện tại (chỉ lấy banners đang trong thời gian hiệu lực)
    if (filters.valid_only === true || filters.valid_only === 'true') {
      const now = new Date();
      query.start_date = { $lte: now };
      query.$or = [
        { end_date: null },
        { end_date: { $gte: now } },
      ];
    }

    const banners = await BannerModel.find(query)
      .sort({ display_order: 1, createdAt: -1 })
      .populate('created_by', 'full_name email')
      .lean();

    return formatBannersForFrontend(banners);
  },

  // Lấy banner theo ID
  detail: async (bannerId) => {
    const banner = await BannerModel.findById(bannerId)
      .populate('created_by', 'full_name email')
      .lean();

    if (!banner) {
      throw new Error('Banner không tồn tại');
    }

    return formatBannerForFrontend(banner);
  },

  // Tạo banner mới
  create: async (data, createdById = null) => {
    const bannerData = {
      ...data,
      created_by: createdById || null,
    };

    const banner = await BannerModel.create(bannerData);
    return formatBannerForFrontend(await BannerModel.findById(banner._id).populate('created_by', 'full_name email').lean());
  },

  // Cập nhật banner
  update: async (bannerId, data) => {
    const banner = await BannerModel.findByIdAndUpdate(
      bannerId,
      { $set: data },
      { new: true, runValidators: true }
    )
      .populate('created_by', 'full_name email')
      .lean();

    if (!banner) {
      throw new Error('Banner không tồn tại');
    }

    return formatBannerForFrontend(banner);
  },

  // Xóa banner
  delete: async (bannerId) => {
    const banner = await BannerModel.findByIdAndDelete(bannerId).lean();

    if (!banner) {
      throw new Error('Banner không tồn tại');
    }

    return formatBannerForFrontend(banner);
  },

  // Tăng click count
  incrementClick: async (bannerId) => {
    await BannerModel.findByIdAndUpdate(bannerId, {
      $inc: { click_count: 1 },
    });
  },

  // Thống kê banners
  getStats: async () => {
    const total = await BannerModel.countDocuments();
    const active = await BannerModel.countDocuments({ is_active: true });
    const inactive = await BannerModel.countDocuments({ is_active: false });

    // Lấy banners theo position
    const byPosition = await BannerModel.aggregate([
      {
        $group: {
          _id: '$position',
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      total,
      active,
      inactive,
      by_position: byPosition,
    };
  },
};

