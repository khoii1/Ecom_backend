import { Router } from "express";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { handle } from "../controllers/base.controller.js";
import { ROLES } from "../constants/roles.js";
import { OrderModel } from "../models/order.model.js";
import { UserModel } from "../models/user.model.js";
import { ProductModel } from "../models/product.model.js";
import { StoreModel } from "../models/store.model.js";
import { CategoryModel } from "../models/category.model.js";
import { OrderItemModel } from "../models/order_item.model.js";
import { ReviewModel } from "../models/review.model.js";
import { param } from "express-validator";
import { validate } from "../middleware/validation.js";

const router = Router();

// GET /analytics/overview - Thống kê tổng quan (Admin)
router.get(
  "/overview",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  handle(async (req, res) => {
    // Tổng doanh thu
    const revenueResult = await OrderModel.aggregate([
      {
        $match: {
          status: { $in: ["paid", "delivered", "shipped"] },
        },
      },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: "$total" },
        },
      },
    ]);
    const totalRevenue =
      revenueResult.length > 0 ? revenueResult[0].total_revenue : 0;

    // Số đơn hàng theo trạng thái
    const ordersResult = await OrderModel.aggregate([
      {
        $group: {
          _id: null,
          total_orders: { $sum: 1 },
          pending_orders: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          paid_orders: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
          },
          shipped_orders: {
            $sum: { $cond: [{ $eq: ["$status", "shipped"] }, 1, 0] },
          },
          delivered_orders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          cancelled_orders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          failed_orders: {
            $sum: { $cond: [{ $eq: ["$status", "payment_failed"] }, 1, 0] },
          },
        },
      },
    ]);
    const orders =
      ordersResult.length > 0
        ? ordersResult[0]
        : {
            total_orders: 0,
            pending_orders: 0,
            paid_orders: 0,
            shipped_orders: 0,
            delivered_orders: 0,
            cancelled_orders: 0,
            failed_orders: 0,
          };

    // Số lượng users, products, stores
    const [
      totalUsers,
      totalCustomers,
      totalSellers,
      totalProducts,
      totalStores,
      totalCategories,
    ] = await Promise.all([
      UserModel.countDocuments({}),
      UserModel.countDocuments({ role: "USER" }),
      UserModel.countDocuments({ role: "SELLER" }),
      ProductModel.countDocuments({ status: "active" }),
      StoreModel.countDocuments({ status: "active" }),
      CategoryModel.countDocuments({}),
    ]);

    // Top 5 sản phẩm bán chạy
    const topProductsResult = await OrderItemModel.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "order_id",
          foreignField: "_id",
          as: "order",
        },
      },
      {
        $unwind: "$order",
      },
      {
        $match: {
          "order.status": { $in: ["paid", "delivered", "shipped"] },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "product_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: "$product",
      },
      {
        $group: {
          _id: "$product_id",
          title: { $first: "$product.title" },
          image_url: { $first: "$product.image_url" },
          price: { $first: "$product.price" },
          total_sold: { $sum: "$qty" },
          total_revenue: { $sum: { $multiply: ["$qty", "$unit_price"] } },
        },
      },
      {
        $sort: { total_sold: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    res.json({
      revenue: {
        total: parseFloat(totalRevenue),
      },
      orders: {
        total: orders.total_orders,
        pending: orders.pending_orders,
        paid: orders.paid_orders,
        shipped: orders.shipped_orders,
        delivered: orders.delivered_orders,
        cancelled: orders.cancelled_orders,
        failed: orders.failed_orders,
      },
      counts: {
        users: totalUsers,
        customers: totalCustomers,
        sellers: totalSellers,
        products: totalProducts,
        stores: totalStores,
        categories: totalCategories,
      },
      topProducts: topProductsResult.map((p) => ({
        id: p._id.toString(),
        title: p.title,
        image_url: p.image_url,
        price: parseFloat(p.price),
        total_sold: p.total_sold,
        total_revenue: parseFloat(p.total_revenue),
      })),
    });
  })
);

// GET /analytics/revenue - Thống kê doanh thu theo thời gian
router.get(
  "/revenue",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  handle(async (req, res) => {
    const { period = "daily", days = 30 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    let dateFormat;
    let groupBy;

    switch (period) {
      case "monthly":
        dateFormat = "%Y-%m";
        groupBy = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
        break;
      case "weekly":
        dateFormat = "%Y-W%V";
        groupBy = {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" },
        };
        break;
      default:
        dateFormat = "%Y-%m-%d";
        groupBy = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        };
    }

    const result = await OrderModel.aggregate([
      {
        $match: {
          status: { $in: ["paid", "delivered", "shipped"] },
          createdAt: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: groupBy,
          order_count: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.json(
      result.map((r) => {
        let periodStr = "";
        if (period === "monthly") {
          periodStr = `${r._id.year}-${String(r._id.month).padStart(2, "0")}`;
        } else if (period === "weekly") {
          periodStr = `${r._id.year}-W${String(r._id.week).padStart(2, "0")}`;
        } else {
          periodStr = `${r._id.year}-${String(r._id.month).padStart(
            2,
            "0"
          )}-${String(r._id.day).padStart(2, "0")}`;
        }
        return {
          period: periodStr,
          order_count: r.order_count,
          revenue: parseFloat(r.revenue),
        };
      })
    );
  })
);

// GET /analytics/store/:storeId - Thống kê cho cửa hàng (Seller)
router.get(
  "/store/:storeId",
  authentication(),
  authorizeByRoles([ROLES.SELLER, ROLES.ADMIN]),
  [
    param("storeId").isMongoId().withMessage("ID cửa hàng không hợp lệ"),
    validate,
  ],
  handle(async (req, res) => {
    const storeId = req.params.storeId;
    const userId = req.currentUser.id;
    const userRole = req.currentUser.role;

    // Import mongoose để convert string sang ObjectId
    const { mongoose } = await import("../config/database.js");
    const ObjectId = mongoose.Types.ObjectId;
    const storeObjectId = new ObjectId(storeId);

    // Kiểm tra quyền truy cập store
    if (userRole !== ROLES.ADMIN) {
      const store = await StoreModel.findById(storeId).lean();
      if (!store || store.owner_id.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({ message: "Không có quyền xem thống kê cửa hàng này" });
      }
    }

    // Doanh thu của store
    const revenueResult = await OrderModel.aggregate([
      {
        $match: {
          store_id: storeObjectId,
          status: { $in: ["paid", "delivered", "shipped"] },
        },
      },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: "$total" },
          total_orders: { $sum: 1 },
        },
      },
    ]);
    const revenue =
      revenueResult.length > 0
        ? revenueResult[0]
        : {
            total_revenue: 0,
            total_orders: 0,
          };

    // Số sản phẩm
    const totalProducts = await ProductModel.countDocuments({
      store_id: storeObjectId,
    });

    // Top sản phẩm của store
    const topProductsResult = await ProductModel.aggregate([
      {
        $match: { store_id: storeObjectId },
      },
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "product_id",
          as: "orderItems",
        },
      },
      {
        $unwind: {
          path: "$orderItems",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderItems.order_id",
          foreignField: "_id",
          as: "order",
        },
      },
      {
        $unwind: {
          path: "$order",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $or: [
            { "order.status": { $in: ["paid", "delivered", "shipped"] } },
            { order: { $exists: false } },
          ],
        },
      },
      {
        $group: {
          _id: "$_id",
          title: { $first: "$title" },
          image_url: { $first: "$image_url" },
          price: { $first: "$price" },
          total_sold: {
            $sum: {
              $cond: [
                { $in: ["$order.status", ["paid", "delivered", "shipped"]] },
                "$orderItems.qty",
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { total_sold: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    // Đánh giá trung bình của store
    const reviewsResult = await ReviewModel.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "product_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: "$product",
      },
      {
        $match: {
          "product.store_id": storeObjectId,
        },
      },
      {
        $group: {
          _id: null,
          total_reviews: { $sum: 1 },
          average_rating: { $avg: "$rating" },
        },
      },
    ]);
    const reviews =
      reviewsResult.length > 0
        ? reviewsResult[0]
        : {
            total_reviews: 0,
            average_rating: 0,
          };

    // Đảm bảo revenue là số hợp lệ, không phải NaN
    const revenueValue = parseFloat(revenue.total_revenue) || 0;
    const finalRevenue = isNaN(revenueValue) ? 0 : revenueValue;

    // Đảm bảo average_rating là số hợp lệ
    const avgRating = reviews.average_rating || 0;
    const finalAvgRating = isNaN(avgRating)
      ? 0
      : Math.round(avgRating * 10) / 10;

    res.json({
      revenue: finalRevenue,
      total_orders: revenue.total_orders || 0,
      total_products: totalProducts || 0,
      reviews: {
        total: reviews.total_reviews || 0,
        average_rating: finalAvgRating,
      },
      topProducts: topProductsResult.map((p) => ({
        id: p._id.toString(),
        title: p.title,
        image_url: p.image_url,
        price: parseFloat(p.price) || 0,
        total_sold: p.total_sold || 0,
      })),
    });
  })
);

// GET /analytics/category-revenue - Thống kê doanh thu theo danh mục (Admin)
router.get(
  "/category-revenue",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  handle(async (req, res) => {
    // Tính doanh thu theo danh mục từ order items
    const categoryRevenueResult = await OrderItemModel.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "order_id",
          foreignField: "_id",
          as: "order",
        },
      },
      {
        $unwind: "$order",
      },
      {
        $match: {
          "order.status": { $in: ["paid", "delivered", "shipped"] },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "product_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: {
          path: "$product",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "product.category_id": { $exists: true, $ne: null },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "product.category_id",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$product.category_id",
          category_name: { $first: "$category.name" },
          revenue: { $sum: { $multiply: ["$qty", "$unit_price"] } },
        },
      },
      {
        $sort: { revenue: -1 },
      },
    ]);

    // Format kết quả
    const result = categoryRevenueResult.map((item) => ({
      name: item.category_name || "Không xác định",
      revenue: parseFloat(item.revenue || 0),
    }));

    // Nếu không có dữ liệu, trả về mảng rỗng
    if (result.length === 0) {
      return res.json([]);
    }

    res.json(result);
  })
);

export default router;
