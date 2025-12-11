import { Router } from "express";
import { body } from "express-validator";
import crypto from "crypto";
import moment from "moment";
import qs from "qs";
import { handle } from "../controllers/base.controller.js";
import { validate } from "../middleware/validation.js";
import { authentication } from "../middleware/authentication.js";
import { OrderModel } from "../models/order.model.js";
import { CartModel } from "../models/cart.model.js";
import { CartItemModel } from "../models/cart_item.model.js";
import { logger } from "../utils/logger.js";

const router = Router();

// --- Controller Logic ---

// Tạo VNPay URL cho nạp tiền vào ví
const createTopupUrl = handle(async (req, res) => {
  const { transactionId, amount, language = "vn", bankCode = "" } = req.body;
  const userId = req.currentUser.id;

  if (!transactionId || !amount) {
    return res
      .status(400)
      .json({ message: "Thiếu thông tin transaction hoặc số tiền" });
  }

  // Kiểm tra transaction có tồn tại và thuộc về user này không
  const { WalletTransactionModel } = await import("../models/wallet_transaction.model.js");
  const transaction = await WalletTransactionModel.findOne({
    _id: transactionId,
    user_id: userId,
    type: "topup",
    status: "pending",
  }).lean();

  if (!transaction) {
    return res.status(404).json({ message: "Giao dịch nạp tiền không tồn tại hoặc đã được xử lý" });
  }

  if (transaction.amount !== amount) {
    return res.status(400).json({ message: "Số tiền không khớp với giao dịch" });
  }

  // --- Lấy thông tin cấu hình từ .env ---
  const tmnCode = process.env.VNP_TMNCODE;
  const secretKey = process.env.VNP_HASHSECRET;
  let vnpUrl = process.env.VNP_URL;
  const returnUrl = process.env.VNP_RETURNURL;

  // --- Chuẩn bị dữ liệu gửi sang VNPay ---
  const date = new Date();
  const createDate = moment(date).format("YYYYMMDDHHmmss");
  // Dùng transactionId làm TxnRef để dễ dàng tìm lại khi IPN
  const orderIdVnp = `${transactionId}_${moment(date).format("HHmmss")}`;
  const ipAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const vnpAmount = amount * 100;

  let vnp_Params = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = tmnCode;
  vnp_Params["vnp_Locale"] = language;
  vnp_Params["vnp_CurrCode"] = "VND";
  vnp_Params["vnp_TxnRef"] = orderIdVnp;
  vnp_Params["vnp_OrderInfo"] = `Nap tien vao vi ${userId}`; // Để phân biệt với order payment
  vnp_Params["vnp_OrderType"] = "other";
  vnp_Params["vnp_Amount"] = vnpAmount;
  vnp_Params["vnp_ReturnUrl"] = returnUrl;
  vnp_Params["vnp_IpAddr"] = ipAddr;
  vnp_Params["vnp_CreateDate"] = createDate;

  if (bankCode !== null && bankCode !== "") {
    vnp_Params["vnp_BankCode"] = bankCode;
  }

  // --- Sắp xếp và tạo hash ---
  vnp_Params = sortObject(vnp_Params);
  const signData = qs.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  vnp_Params["vnp_SecureHash"] = signed;

  // --- Tạo URL thanh toán ---
  vnpUrl += "?" + qs.stringify(vnp_Params, { encode: false });

  logger.info("VNPAY", "Tạo URL nạp tiền thành công", {
    transactionId,
    amount,
    userId,
  });
  res.json({ paymentUrl: vnpUrl });
});

const createPaymentUrl = handle(async (req, res) => {
  // --- Lấy thông tin cần thiết ---
  const { orderId, amount, language = "vn", bankCode = "" } = req.body;
  const userId = req.currentUser.id;

  if (!orderId || !amount) {
    return res
      .status(400)
      .json({ message: "Thiếu thông tin đơn hàng hoặc số tiền" });
  }

  // --- Lấy thông tin cấu hình từ .env ---
  const tmnCode = process.env.VNP_TMNCODE;
  const secretKey = process.env.VNP_HASHSECRET;
  let vnpUrl = process.env.VNP_URL;
  const returnUrl = process.env.VNP_RETURNURL;

  // --- Chuẩn bị dữ liệu gửi sang VNPay ---
  const date = new Date();
  const createDate = moment(date).format("YYYYMMDDHHmmss");
  const orderIdVnp = `${orderId}_${moment(date).format("HHmmss")}`; // Đảm bảo TxnRef duy nhất mỗi lần tạo URL
  const ipAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // Sửa lại amount: VNPay yêu cầu nhân 100 (đơn vị xu)
  const vnpAmount = amount * 100;

  let vnp_Params = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = tmnCode;
  vnp_Params["vnp_Locale"] = language;
  vnp_Params["vnp_CurrCode"] = "VND";
  vnp_Params["vnp_TxnRef"] = orderIdVnp; // Mã tham chiếu giao dịch (duy nhất)
  vnp_Params["vnp_OrderInfo"] = `Thanh toan don hang ${orderId}`;
  vnp_Params["vnp_OrderType"] = "other"; // Hoặc loại phù hợp
  vnp_Params["vnp_Amount"] = vnpAmount;
  vnp_Params["vnp_ReturnUrl"] = returnUrl;
  vnp_Params["vnp_IpAddr"] = ipAddr;
  vnp_Params["vnp_CreateDate"] = createDate;

  if (bankCode !== null && bankCode !== "") {
    vnp_Params["vnp_BankCode"] = bankCode;
  }

  // --- Sắp xếp và tạo hash ---
  vnp_Params = sortObject(vnp_Params);
  const signData = qs.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  vnp_Params["vnp_SecureHash"] = signed;

  // --- Tạo URL thanh toán ---
  vnpUrl += "?" + qs.stringify(vnp_Params, { encode: false });

  logger.info("VNPAY", "Tạo URL thanh toán thành công", {
    orderId,
    amount,
    userId,
  });
  res.json({ paymentUrl: vnpUrl });
});

// --- Xử lý kết quả VNPay trả về (Return URL) ---
const vnpayReturn = handle(async (req, res) => {
  let vnp_Params = req.query;
  const secureHash = vnp_Params["vnp_SecureHash"];

  // Xóa hash ra khỏi params để kiểm tra
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"]; // Nếu có

  vnp_Params = sortObject(vnp_Params);
  const secretKey = process.env.VNP_HASHSECRET;
  const signData = qs.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  const orderId = vnp_Params["vnp_TxnRef"].split("_")[0]; // Lấy lại orderId gốc
  const responseCode = vnp_Params["vnp_ResponseCode"];
  let redirectUrl = process.env.FRONTEND_PAYMENT_REDIRECT_URL || "/";

  const queryParams = {
    orderId: orderId,
    vnp_TxnRef: vnp_Params["vnp_TxnRef"],
    vnp_ResponseCode: responseCode,
    vnp_TransactionStatus: vnp_Params["vnp_TransactionStatus"], // Thêm trạng thái chi tiết
    status: "unknown", // Khởi tạo trạng thái sơ bộ
    message: "Unknown", // Khởi tạo message
  };

  if (secureHash === signed) {
    logger.info("VNPAY", `Return Checksum OK`, { orderId, responseCode });
    // KHÔNG cập nhật DB ở đây, chỉ chuẩn bị redirect
    queryParams.status = responseCode === "00" ? "success" : "failed";
    queryParams.message = getVnpResponseMessage(responseCode);
  } else {
    logger.error("VNPAY", `Return Checksum FAILED`, { orderId });
    queryParams.status = "failed";
    queryParams.message = "Checksum không hợp lệ";
  }

  // Thêm query params vào redirect URL
  redirectUrl += "?" + qs.stringify(queryParams);
  logger.info("VNPAY", `Redirecting user`, {
    orderId,
    status: queryParams.status,
  });
  res.redirect(redirectUrl);
});

// --- Xử lý IPN (Instant Payment Notification) từ VNPay (QUAN TRỌNG) ---
const vnpayIpn = handle(async (req, res) => {
  logger.info("VNPAY", "=== Nhận IPN Request ===", { params: req.query });

  let vnp_Params = req.query;
  const secureHash = vnp_Params["vnp_SecureHash"];

  // Xóa hash ra khỏi params để kiểm tra
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"]; // Nếu có

  vnp_Params = sortObject(vnp_Params);
  const secretKey = process.env.VNP_HASHSECRET;
  const signData = qs.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  const orderIdStr = vnp_Params["vnp_TxnRef"]?.split("_")[0];
  const vnpResponseCode = vnp_Params["vnp_ResponseCode"];
  const vnpTransactionStatus = vnp_Params["vnp_TransactionStatus"];
  // Chia lại cho 100 và kiểm tra null/undefined
  const vnpAmount = vnp_Params["vnp_Amount"]
    ? parseInt(vnp_Params["vnp_Amount"], 10) / 100
    : undefined;

  // <<< Thêm kiểm tra tham số đầu vào >>>
  if (!orderIdStr || !vnpResponseCode || vnpAmount === undefined) {
    logger.error("VNPAY", "IPN Error: Thiếu tham số bắt buộc", vnp_Params);
    return res.json({ RspCode: "01", Message: "Missing parameters" });
  }

      logger.info("VNPAY", `Xử lý IPN`, {
        orderId: orderIdStr,
        vnp_TxnRef: vnp_Params["vnp_TxnRef"],
        responseCode: vnpResponseCode,
        orderInfo: vnp_Params["vnp_OrderInfo"],
      });

  if (secureHash === signed) {
    logger.info("VNPAY", `IPN Checksum OK`, { orderId: orderIdStr });
    try {
      // Phân biệt loại giao dịch: order payment hoặc wallet topup
      const orderInfo = vnp_Params["vnp_OrderInfo"] || "";
      const isTopup = orderInfo.toLowerCase().includes("nap tien") || orderInfo.toLowerCase().includes("topup");
      
      if (isTopup) {
        // Xử lý nạp tiền vào ví
        const { WalletService } = await import("../services/wallet.service.js");
        const { WalletTransactionModel } = await import("../models/wallet_transaction.model.js");
        
        // Tìm transaction topup bằng vnp_TxnRef
        const vnpTxnRef = vnp_Params["vnp_TxnRef"];
        const transaction = await WalletTransactionModel.findOne({
          vnp_transaction_ref: vnpTxnRef,
          type: "topup",
          status: "pending",
        }).lean();
        
        if (!transaction) {
          // Thử tìm bằng _id nếu vnp_TxnRef chứa transactionId
          const transactionIdFromRef = vnpTxnRef.split("_")[0];
          const transactionById = await WalletTransactionModel.findById(transactionIdFromRef).lean();
          
          if (!transactionById || transactionById.type !== "topup" || transactionById.status !== "pending") {
            logger.error("VNPAY", `IPN Error: Giao dịch nạp tiền không tồn tại`, { vnpTxnRef });
            return res.json({ RspCode: "01", Message: "Topup transaction not found" });
          }
          
          // Cập nhật trạng thái nạp tiền
          await WalletService.updateTopupStatus(
            transactionById._id.toString(),
            vnpResponseCode,
            vnpTxnRef
          );
          
          logger.info("VNPAY", `IPN Topup xử lý thành công`, { transactionId: transactionById._id.toString() });
          return res.json({ RspCode: "00", Message: "Confirm Success" });
        }
        
        // Cập nhật trạng thái nạp tiền
        await WalletService.updateTopupStatus(
          transaction._id.toString(),
          vnpResponseCode,
          vnpTxnRef
        );
        
        logger.info("VNPAY", `IPN Topup xử lý thành công`, { transactionId: transaction._id.toString() });
        return res.json({ RspCode: "00", Message: "Confirm Success" });
      }
      
      // Xử lý thanh toán đơn hàng (logic cũ)
      // 1. Kiểm tra đơn hàng trong DB
      const order = await OrderModel.findById(orderIdStr).lean();
      if (!order) {
        logger.error("VNPAY", `IPN Error: Đơn hàng không tồn tại`, { orderId: orderIdStr });
        return res.json({ RspCode: "01", Message: "Order not found" }); // Mã VNPay: Order không tồn tại
      }

      // 2. Kiểm tra số tiền
      const orderTotal = parseFloat(order.total);
      if (isNaN(orderTotal)) {
        // Kiểm tra xem order.total có hợp lệ không
        logger.error("VNPAY", `IPN DB Error: Tổng tiền không hợp lệ trong DB`, {
          orderId,
        });
        return res.json({
          RspCode: "99",
          Message: "DB Error: Invalid order total",
        });
      }
      if (orderTotal !== vnpAmount) {
        logger.error("VNPAY", `IPN Error: Số tiền không khớp`, {
          orderId,
          dbAmount: orderTotal,
          vnpAmount,
        });
        return res.json({ RspCode: "04", Message: "Invalid amount" }); // Mã VNPay: Sai số tiền
      }

      // 3. Kiểm tra trạng thái đơn hàng (tránh cập nhật lại đơn đã hoàn thành/hủy)
      if (order.status !== "pending" && order.status !== "payment_failed") {
        logger.info("VNPAY", `IPN Info: Đơn hàng đã được xử lý`, {
          orderId,
          status: order.status,
        });
        // Nếu đã paid, trả về thành công cho VNPay
        if (order.status === "paid") {
          return res.json({ RspCode: "00", Message: "Confirm Success" });
        } else {
          // Các trạng thái khác (cancelled, shipped,...) cũng coi như đã xử lý
          return res.json({
            RspCode: "02", // Mã VNPay: Order đã được confirm trước đó
            Message: "Order already confirmed",
          });
        }
      }

      // 4. Cập nhật trạng thái đơn hàng dựa trên kết quả IPN
      let newStatus;
      // Chỉ coi là thành công khi cả ResponseCode và TransactionStatus đều là '00'
      if (vnpResponseCode === "00" && vnpTransactionStatus === "00") {
        newStatus = "paid";
        logger.info("VNPAY", `IPN Success: Cập nhật đơn hàng thành 'paid'`, {
          orderId,
        });
      } else {
        newStatus = "payment_failed";
        logger.warn(
          "VNPAY",
          `IPN Failed: Cập nhật đơn hàng thành 'payment_failed'`,
          {
            orderId,
            responseCode: vnpResponseCode,
            transactionStatus: vnpTransactionStatus,
          }
        );
      }

      await OrderModel.findByIdAndUpdate(orderId, {
        $set: { status: newStatus },
      });

      // 5. Nếu thanh toán thành công ('paid'), giảm stock từ reserved và xóa giỏ hàng
      if (newStatus === "paid") {
        const { OrderItemModel } = await import(
          "../models/order_item.model.js"
        );
        const { ProductModel } = await import("../models/product.model.js");

        // Lấy order items và giảm stock từ reserved
        const orderItems = await OrderItemModel.find({
          order_id: orderId,
        }).lean();
        for (const item of orderItems) {
          // Giảm stock_quantity và giảm reserved_quantity
          await ProductModel.findByIdAndUpdate(item.product_id, {
            $inc: {
              stock_quantity: -item.qty,
              reserved_quantity: -item.qty,
            },
          });
        }
        logger.info("VNPAY", `Đã giảm stock sau thanh toán thành công`, {
          orderId,
        });

        // Xóa giỏ hàng
        logger.info("VNPAY", `Xóa giỏ hàng sau thanh toán thành công`, {
          userId: order.buyer_id,
          orderId,
        });
        const cart = await CartModel.findOne({
          user_id: order.buyer_id,
        }).lean();
        if (cart) {
          await CartItemModel.deleteMany({ cart_id: cart._id });
          logger.info("VNPAY", `Đã xóa giỏ hàng`, { userId: order.buyer_id });
        } else {
          logger.warn("VNPAY", `Không tìm thấy giỏ hàng để xóa`, {
            userId: order.buyer_id,
          });
        }
      }

      // 6. Phản hồi thành công cho VNPay
      logger.info("VNPAY", `IPN xử lý thành công`, { orderId, newStatus });
      res.json({ RspCode: "00", Message: "Confirm Success" });
    } catch (dbError) {
      logger.error("VNPAY", `IPN DB Error`, {
        orderId,
        error: dbError.message,
      });
      res.json({ RspCode: "99", Message: "Unknown error" }); // Lỗi hệ thống khi tương tác DB
    }
  } else {
    logger.error("VNPAY", `IPN Checksum FAILED`, { orderId });
    res.json({ RspCode: "97", Message: "Invalid Checksum" }); // Sai chữ ký
  }
});

// --- Helper function ---
function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    // Chỉ sort các tham số bắt đầu bằng 'vnp_'
    if (obj.hasOwnProperty(key) && key.startsWith("vnp_")) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort(); // Sắp xếp theo alphabet
  for (key = 0; key < str.length; key++) {
    // Decode key trước khi dùng làm key của object sorted
    const decodedKey = decodeURIComponent(str[key]);
    // Encode value, thay %20 bằng +
    sorted[decodedKey] = encodeURIComponent(obj[decodedKey]).replace(
      /%20/g,
      "+"
    );
  }
  return sorted;
}

function getVnpResponseMessage(responseCode) {
  // <<< SỬA: Đảm bảo key là string >>>
  const messages = {
    "00": "Giao dịch thành công",
    "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên hệ VNPAY).",
    "09": "Thẻ/Tài khoản chưa đăng ký Internet Banking.",
    10: "Thẻ/Tài khoản xác thực không thành công.",
    11: "Giao dịch chờ xác nhận OTP.",
    12: "Thẻ/Tài khoản hết hạn.",
    13: "Nhập sai OTP quá số lần quy định.",
    24: "Hủy giao dịch.",
    51: "Tài khoản không đủ số dư.",
    65: "Tài khoản bị khóa.",
    75: "Ngân hàng bảo trì.",
    79: "Khách hàng nhập sai mật khẩu thanh toán quá số lần quy định.",
    99: "Lỗi không xác định.",
  };
  return messages[responseCode] || "Giao dịch thất bại"; // Truy cập bằng key string
}

// --- Validation ---
const createUrlValidation = [
  body("orderId").isMongoId().withMessage("ID đơn hàng không hợp lệ"),
  body("amount").isFloat({ gt: 0 }).withMessage("Số tiền không hợp lệ"),
  body("language")
    .optional()
    .isIn(["vn", "en"])
    .withMessage("Ngôn ngữ không hợp lệ"),
  body("bankCode")
    .optional()
    .isString()
    .withMessage("Mã ngân hàng không hợp lệ"),
  validate,
];

const createTopupUrlValidation = [
  body("transactionId").isMongoId().withMessage("ID giao dịch không hợp lệ"),
  body("amount").isFloat({ gt: 0 }).withMessage("Số tiền không hợp lệ"),
  body("language")
    .optional()
    .isIn(["vn", "en"])
    .withMessage("Ngôn ngữ không hợp lệ"),
  body("bankCode")
    .optional()
    .isString()
    .withMessage("Mã ngân hàng không hợp lệ"),
  validate,
];

// --- Routes ---
router.post(
  "/create_payment_url",
  authentication(),
  createUrlValidation,
  createPaymentUrl
);
router.post(
  "/create_topup_url",
  authentication(),
  createTopupUrlValidation,
  createTopupUrl
);
router.get("/vnpay_return", vnpayReturn); // VNPay gọi bằng GET
router.get("/vnpay_ipn", vnpayIpn); // VNPay gọi bằng GET

export default router;
