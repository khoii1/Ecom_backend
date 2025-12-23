import { Router } from "express";
import { body, param } from "express-validator";
import { ReviewModel } from "../models/review.model.js";
import { authentication } from "../middleware/authentication.js";
import { authorizeByRoles } from "../middleware/authorization.js";
import { validate } from "../middleware/validation.js";
import { handle } from "../controllers/base.controller.js";
import { ProductModel } from "../models/product.model.js";
import { uploadMultiple, validateReviewImages } from "../middleware/upload.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Validation
const reviewValidation = [
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Đánh giá phải từ 1-5 sao"),
  body("comment")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Bình luận tối đa 1000 ký tự"),
  body("order_id").isMongoId().withMessage("Mã đơn hàng không hợp lệ"),
  body("image_urls")
    .optional()
    .isArray()
    .withMessage("image_urls phải là mảng"),
  body("image_urls.*").optional().isURL().withMessage("URL ảnh không hợp lệ"),
];

const productIdValidation = [
  param("productId").isMongoId().withMessage("ID sản phẩm không hợp lệ"),
];

// GET /reviews - Admin xem tất cả reviews trong hệ thống
router.get(
  "/",
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  handle(async (req, res) => {
    const { limit = 50, offset = 0, rating, product_id } = req.query;

    const query = {};

    if (rating) {
      query.rating = parseInt(rating);
    }

    if (product_id) {
      query.product_id = product_id;
    }

    const reviews = await ReviewModel.find(query)
      .populate("user_id", "full_name email")
      .populate("product_id", "title image_url store_id")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await ReviewModel.countDocuments(query);

    // Populate store info cho products
    const { StoreModel } = await import("../models/store.model.js");
    const productIds = [
      ...new Set(
        reviews
          .map((r) => r.product_id?._id?.toString() || r.product_id?.toString())
          .filter(Boolean)
      ),
    ];
    const products =
      productIds.length > 0
        ? await ProductModel.find({ _id: { $in: productIds } })
            .populate("store_id", "name")
            .lean()
        : [];

    const productMap = new Map();
    products.forEach((product) => {
      productMap.set(product._id.toString(), product);
    });

    res.json({
      reviews: reviews.map((r) => ({
        ...r,
        id: r._id.toString(),
        product_id: r.product_id?._id.toString() || r.product_id?.toString(),
        product_title: r.product_id?.title || null,
        product_image_url: r.product_id?.image_url || null,
        store_name:
          productMap.get(r.product_id?._id?.toString())?.store_id?.name || null,
        user_id: r.user_id?._id.toString() || r.user_id?.toString(),
        user_name: r.user_id?.full_name || null,
        user_email: r.user_id?.email || null,
        order_id: r.order_id?.toString() || r.order_id?.toString(),
        created_at: r.createdAt ? r.createdAt.toISOString() : null,
        updated_at: r.updatedAt ? r.updatedAt.toISOString() : null,
      })),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  })
);

// GET /reviews/product/:productId - Lấy tất cả reviews của sản phẩm
router.get(
  "/product/:productId",
  productIdValidation,
  validate,
  handle(async (req, res) => {
    const productId = req.params.productId;

    const reviews = await ReviewModel.find({ product_id: productId })
      .populate("user_id", "full_name email")
      .sort({ createdAt: -1 })
      .lean();

    const stats = await ReviewModel.getProductStats(productId);

    res.json({
      reviews: reviews.map((r) => ({
        ...r,
        id: r._id.toString(),
        product_id: r.product_id.toString(),
        user_id: r.user_id?._id.toString() || r.user_id.toString(),
        order_id: r.order_id?.toString() || r.order_id.toString(),
        user_name: r.user_id?.full_name || null,
        image_urls: r.image_urls || [],
        seller_response: r.seller_response || null,
        seller_response_at: r.seller_response_at
          ? r.seller_response_at.toISOString()
          : null,
        created_at: r.createdAt ? r.createdAt.toISOString() : null,
        updated_at: r.updatedAt ? r.updatedAt.toISOString() : null,
      })),
      stats: {
        total_reviews: stats.total_reviews,
        average_rating: stats.average_rating || 0,
        five_star: stats.five_star || 0,
        four_star: stats.four_star || 0,
        three_star: stats.three_star || 0,
        two_star: stats.two_star || 0,
        one_star: stats.one_star || 0,
      },
    });
  })
);

// GET /reviews/product/:productId/available-orders - Lấy danh sách đơn hàng có thể đánh giá
router.get(
  "/product/:productId/available-orders",
  authentication(),
  productIdValidation,
  validate,
  handle(async (req, res) => {
    const productId = req.params.productId;
    const userId = req.currentUser.id;

    const { OrderModel } = await import("../models/order.model.js");
    const { OrderItemModel } = await import("../models/order_item.model.js");

    // Lấy tất cả đơn hàng đã thanh toán của user
    const allowedStatuses = ["paid", "processing", "shipped", "delivered"];
    const orders = await OrderModel.find({
      buyer_id: userId,
      status: { $in: allowedStatuses },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Lọc các đơn hàng có chứa sản phẩm này
    const availableOrders = [];
    for (const order of orders) {
      // Kiểm tra order có chứa sản phẩm này
      const orderItem = await OrderItemModel.findOne({
        order_id: order._id,
        product_id: productId,
      }).lean();

      if (!orderItem) continue;

      // Kiểm tra đã đánh giá chưa
      const existingReview = await ReviewModel.findOne({
        order_id: order._id,
        product_id: productId,
      }).lean();

      // Chỉ thêm vào danh sách nếu chưa đánh giá
      if (!existingReview) {
        availableOrders.push({
          id: order._id.toString(),
          code: order.code,
          total: order.total,
          status: order.status,
          created_at: order.createdAt ? order.createdAt.toISOString() : null,
        });
      }
    }

    res.json({
      orders: availableOrders,
      total: availableOrders.length,
    });
  })
);

// POST /reviews/product/:productId - Tạo review mới
router.post(
  "/product/:productId",
  authentication(),
  productIdValidation,
  reviewValidation,
  validate,
  handle(async (req, res) => {
    const productId = req.params.productId;
    const userId = req.currentUser.id;
    const { rating, comment, order_id, image_urls } = req.body;

    // Kiểm tra order_id có được cung cấp
    if (!order_id) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp order_id (mã đơn hàng)" });
    }

    // Kiểm tra order tồn tại và thuộc về user
    const { OrderModel } = await import("../models/order.model.js");
    const { OrderItemModel } = await import("../models/order_item.model.js");

    const order = await OrderModel.findOne({
      _id: order_id,
      buyer_id: userId,
    }).lean();

    if (!order) {
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng hoặc đơn hàng không thuộc về bạn",
      });
    }

    // Kiểm tra order đã hoàn thành (delivered hoặc paid/processing trở lên)
    const allowedStatuses = ["paid", "processing", "shipped", "delivered"];
    if (!allowedStatuses.includes(order.status)) {
      return res.status(400).json({
        message:
          "Chỉ có thể đánh giá sản phẩm sau khi đơn hàng đã được thanh toán",
      });
    }

    // Kiểm tra order có chứa sản phẩm này không
    const orderItem = await OrderItemModel.findOne({
      order_id: order_id,
      product_id: productId,
    }).lean();

    if (!orderItem) {
      return res
        .status(400)
        .json({ message: "Sản phẩm này không có trong đơn hàng này" });
    }

    // Kiểm tra đã review order này chưa
    const existingReview = await ReviewModel.findOne({
      order_id: order_id,
      product_id: productId,
    }).lean();

    if (existingReview) {
      return res
        .status(400)
        .json({ message: "Bạn đã đánh giá sản phẩm này cho đơn hàng này rồi" });
    }

    // Xử lý image_urls - có thể là array hoặc string (JSON)
    let reviewImageUrls = [];
    if (image_urls) {
      if (typeof image_urls === "string") {
        try {
          reviewImageUrls = JSON.parse(image_urls);
        } catch (e) {
          reviewImageUrls = [image_urls];
        }
      } else if (Array.isArray(image_urls)) {
        reviewImageUrls = image_urls;
      }
    }

    const review = await ReviewModel.create({
      product_id: productId,
      user_id: userId,
      order_id: order_id,
      rating,
      comment: comment || null,
      image_urls: reviewImageUrls,
    });

    res.status(201).json({
      ...review.toObject(),
      id: review._id.toString(),
      product_id: review.product_id.toString(),
      user_id: review.user_id.toString(),
      order_id: review.order_id.toString(),
      created_at: review.createdAt ? review.createdAt.toISOString() : null,
      updated_at: review.updatedAt ? review.updatedAt.toISOString() : null,
    });
  })
);

// PUT /reviews/:reviewId - Cập nhật review
router.put(
  "/:reviewId",
  authentication(),
  [
    param("reviewId").isMongoId().withMessage("ID review không hợp lệ"),
    ...reviewValidation,
  ],
  validate,
  handle(async (req, res) => {
    const reviewId = req.params.reviewId;
    const userId = req.currentUser.id;
    const { rating, comment } = req.body;

    // Kiểm tra review tồn tại và thuộc về user
    const existingReview = await ReviewModel.findById(reviewId).lean();

    if (!existingReview) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }

    if (existingReview.user_id.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền sửa đánh giá này" });
    }

    // Xử lý image_urls nếu có
    const updateData = {
      rating,
      comment: comment || null,
    };

    if (req.body.image_urls !== undefined) {
      let reviewImageUrls = [];
      if (req.body.image_urls) {
        if (typeof req.body.image_urls === "string") {
          try {
            reviewImageUrls = JSON.parse(req.body.image_urls);
          } catch (e) {
            reviewImageUrls = [req.body.image_urls];
          }
        } else if (Array.isArray(req.body.image_urls)) {
          reviewImageUrls = req.body.image_urls;
        }
      }
      updateData.image_urls = reviewImageUrls;
    }

    const updatedReview = await ReviewModel.findByIdAndUpdate(
      reviewId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    res.json({
      ...updatedReview,
      id: updatedReview._id.toString(),
      product_id: updatedReview.product_id.toString(),
      user_id: updatedReview.user_id.toString(),
      created_at: updatedReview.createdAt
        ? updatedReview.createdAt.toISOString()
        : null,
      updated_at: updatedReview.updatedAt
        ? updatedReview.updatedAt.toISOString()
        : null,
    });
  })
);

// DELETE /reviews/:reviewId - Xóa review
router.delete(
  "/:reviewId",
  authentication(),
  [param("reviewId").isMongoId().withMessage("ID review không hợp lệ")],
  validate,
  handle(async (req, res) => {
    const reviewId = req.params.reviewId;
    const userId = req.currentUser.id;
    const userRole = req.currentUser.role;

    // Kiểm tra review tồn tại
    const existingReview = await ReviewModel.findById(reviewId).lean();

    if (!existingReview) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }

    // Chỉ chủ review hoặc admin mới được xóa
    if (
      existingReview.user_id.toString() !== userId.toString() &&
      userRole !== "ADMIN"
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xóa đánh giá này" });
    }

    await ReviewModel.findByIdAndDelete(reviewId);
    res.json({ message: "Xóa đánh giá thành công" });
  })
);

// GET /reviews/my - Lấy tất cả reviews của user hiện tại
router.get(
  "/my",
  authentication(),
  handle(async (req, res) => {
    const userId = req.currentUser.id;

    const reviews = await ReviewModel.find({ user_id: userId })
      .populate("product_id", "title image_url")
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      reviews.map((r) => ({
        ...r,
        id: r._id.toString(),
        product_id: r.product_id?._id.toString() || r.product_id.toString(),
        user_id: r.user_id.toString(),
        product_title: r.product_id?.title || null,
        product_image_url: r.product_id?.image_url || null,
        created_at: r.createdAt ? r.createdAt.toISOString() : null,
        updated_at: r.updatedAt ? r.updatedAt.toISOString() : null,
      }))
    );
  })
);

// POST /reviews/upload-images - Upload ảnh cho review
router.post(
  "/upload-images",
  authentication(),
  uploadMultiple("images", 5, true), // Cho phép tối đa 5 ảnh, dùng folder review
  validateReviewImages, // Validate sau khi upload
  handle(async (req, res) => {
    // Cloudinary tự động trả về secure_url sau khi upload
    const imageUrls = req.files.map((file) => file.path); // Array các Cloudinary URL

    res.json({
      message: "Upload ảnh thành công",
      image_urls: imageUrls,
      count: imageUrls.length,
    });
  })
);

// PUT /reviews/:reviewId/response - Seller phản hồi review
router.put(
  "/:reviewId/response",
  authentication(),
  [
    param("reviewId").isMongoId().withMessage("ID review không hợp lệ"),
    body("response")
      .trim()
      .notEmpty()
      .withMessage("Phản hồi không được để trống")
      .isLength({ max: 1000 })
      .withMessage("Phản hồi tối đa 1000 ký tự"),
  ],
  validate,
  handle(async (req, res) => {
    const reviewId = req.params.reviewId;
    const userId = req.currentUser.id;
    const userRole = req.currentUser.role;
    const { response } = req.body;

    // Chỉ SELLER hoặc ADMIN mới được phản hồi
    if (userRole !== "SELLER" && userRole !== "ADMIN") {
      return res
        .status(403)
        .json({ message: "Chỉ người bán mới có thể phản hồi đánh giá" });
    }

    // Kiểm tra review tồn tại
    const existingReview = await ReviewModel.findById(reviewId)
      .populate("product_id", "store_id")
      .lean();

    if (!existingReview) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }

    // Kiểm tra quyền: Seller chỉ có thể phản hồi reviews của sản phẩm trong store của mình
    if (userRole === "SELLER") {
      const { StoreModel } = await import("../models/store.model.js");
      const product = existingReview.product_id;

      if (!product || !product.store_id) {
        return res
          .status(400)
          .json({ message: "Không tìm thấy thông tin cửa hàng của sản phẩm" });
      }

      const store = await StoreModel.findById(product.store_id).lean();
      if (!store || store.owner_id.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền phản hồi đánh giá này" });
      }
    }

    // Cập nhật phản hồi
    // Không cần update product rating khi chỉ update seller_response
    const updatedReview = await ReviewModel.findByIdAndUpdate(
      reviewId,
      {
        $set: {
          seller_response: response,
          seller_response_at: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
        // Không chạy post hook vì seller_response không ảnh hưởng đến rating
        // Post hook sẽ tự động chạy nhưng không cần thiết ở đây
      }
    )
      .populate("user_id", "full_name email")
      .lean();

    res.json({
      ...updatedReview,
      id: updatedReview._id.toString(),
      product_id: updatedReview.product_id.toString(),
      user_id:
        updatedReview.user_id?._id.toString() ||
        updatedReview.user_id.toString(),
      order_id:
        updatedReview.order_id?.toString() || updatedReview.order_id.toString(),
      user_name: updatedReview.user_id?.full_name || null,
      seller_response: updatedReview.seller_response,
      seller_response_at: updatedReview.seller_response_at
        ? updatedReview.seller_response_at.toISOString()
        : null,
      created_at: updatedReview.createdAt
        ? updatedReview.createdAt.toISOString()
        : null,
      updated_at: updatedReview.updatedAt
        ? updatedReview.updatedAt.toISOString()
        : null,
    });
  })
);

export default router;
