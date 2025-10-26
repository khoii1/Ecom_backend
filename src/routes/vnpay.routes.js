import { Router } from "express";
import { body } from "express-validator";
import crypto from "crypto";
import moment from "moment";
import qs from "qs";
import { handle } from "../controllers/base.controller.js";
import { validate } from "../middleware/validation.js";
import { authentication } from "../middleware/authentication.js";
import { OrderModel } from "../models/order.model.js";
import { databasePool } from "../config/database.js"; 

const router = Router();

// --- Controller Logic ---

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
  const returnUrl = process.env.VNP_RETURNURL; // Backend URL
  // const ipnUrl = process.env.VNP_IPNURL; // Optional IPN URL

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
  // vnp_Params['vnp_ExpireDate'] = expireDate; // Nếu cần giới hạn thời gian thanh toán
  // vnp_Params['vnp_IpnURL'] = ipnUrl; // Nếu dùng IPN

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

  console.log("VNPay URL created:", vnpUrl);
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
    console.log(`VNPay Return Checksum OK for Order ID: ${orderId}`);
    // KHÔNG cập nhật DB ở đây, chỉ chuẩn bị redirect
    queryParams.status = responseCode === "00" ? "success" : "failed";
    queryParams.message = getVnpResponseMessage(responseCode);
  } else {
    console.error(`VNPay Return Checksum FAILED for Order ID: ${orderId}`);
    queryParams.status = "failed";
    queryParams.message = "Checksum không hợp lệ";
  }

  // Thêm query params vào redirect URL
  redirectUrl += "?" + qs.stringify(queryParams);
  console.log(`Redirecting user to: ${redirectUrl}`);
  res.redirect(redirectUrl);
});

// --- Xử lý IPN (Instant Payment Notification) từ VNPay (QUAN TRỌNG) ---
const vnpayIpn = handle(async (req, res) => {
  // <<< BẮT ĐẦU LOGGING ĐÃ THÊM >>>
  console.log("--- Received IPN Request ---");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Query Params:", req.query);
  // <<< KẾT THÚC LOGGING ĐÃ THÊM >>>

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

  const orderIdStr = vnp_Params["vnp_TxnRef"]?.split("_")[0]; // Thêm ?. để tránh lỗi nếu TxnRef thiếu
  const vnpResponseCode = vnp_Params["vnp_ResponseCode"];
  const vnpTransactionStatus = vnp_Params["vnp_TransactionStatus"];
  // Chia lại cho 100 và kiểm tra null/undefined
  const vnpAmount = vnp_Params["vnp_Amount"]
    ? parseInt(vnp_Params["vnp_Amount"], 10) / 100
    : undefined;

  // <<< Thêm kiểm tra tham số đầu vào >>>
  if (!orderIdStr || !vnpResponseCode || vnpAmount === undefined) {
    console.error("IPN Error: Missing required parameters.", vnp_Params); // Log cả params để xem
    // VNPay yêu cầu RspCode '01' cho Order Not Found, nhưng ở đây là thiếu param nên dùng mã khác
    // Tuy nhiên, để đơn giản, có thể dùng tạm mã lỗi chung '99' hoặc '01'
    return res.json({ RspCode: "01", Message: "Missing parameters" });
  }

  const orderId = parseInt(orderIdStr, 10);
  // Kiểm tra xem parseInt có thành công không
  if (isNaN(orderId)) {
    console.error(
      "IPN Error: Invalid Order ID parsed from vnp_TxnRef.",
      vnp_Params["vnp_TxnRef"]
    );
    return res.json({ RspCode: "01", Message: "Invalid Order ID" });
  }

  console.log(
    `Processing IPN for Order ID: ${orderId}, vnp_TxnRef: ${vnp_Params["vnp_TxnRef"]}, ResponseCode: ${vnpResponseCode}`
  );

  if (secureHash === signed) {
    console.log(`IPN Checksum OK for Order ID: ${orderId}`);
    try {
      // 1. Kiểm tra đơn hàng trong DB
      const order = await OrderModel.findById(orderId);
      if (!order) {
        console.error(`IPN Error: Order ${orderId} not found.`);
        return res.json({ RspCode: "01", Message: "Order not found" }); // Mã VNPay: Order không tồn tại
      }

      // 2. Kiểm tra số tiền
      const orderTotal = parseFloat(order.total);
      if (isNaN(orderTotal)) {
        // Kiểm tra xem order.total có hợp lệ không
        console.error(
          `IPN DB Error: Invalid total amount in database for Order ${orderId}.`
        );
        return res.json({
          RspCode: "99",
          Message: "DB Error: Invalid order total",
        });
      }
      if (orderTotal !== vnpAmount) {
        console.error(
          `IPN Error: Amount mismatch for Order ${orderId}. DB: ${orderTotal}, VNP: ${vnpAmount}`
        );
        return res.json({ RspCode: "04", Message: "Invalid amount" }); // Mã VNPay: Sai số tiền
      }

      // 3. Kiểm tra trạng thái đơn hàng (tránh cập nhật lại đơn đã hoàn thành/hủy)
      if (order.status !== "pending" && order.status !== "payment_failed") {
        console.log(
          `IPN Info: Order ${orderId} already processed (status: ${order.status}). TxnRef: ${vnp_Params["vnp_TxnRef"]}`
        );
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
        console.log(`IPN Success: Updating Order ${orderId} to 'paid'.`);
      } else {
        newStatus = "payment_failed";
        console.log(
          `IPN Failed: Updating Order ${orderId} to 'payment_failed'. ResponseCode: ${vnpResponseCode}, Status: ${vnpTransactionStatus}`
        );
      }

      await OrderModel.updateById(orderId, { status: newStatus });

      // 5. Nếu thanh toán thành công ('paid'), xóa giỏ hàng
      if (newStatus === "paid") {
        console.log(
          `Clearing cart items for user ${order.buyer_id} (Order ${orderId})`
        );
        // Đảm bảo buyer_id là số trước khi query
        const buyerId = parseInt(order.buyer_id, 10);
        if (!isNaN(buyerId)) {
          await databasePool.query(
            `DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)`,
            [buyerId] // Truyền buyerId dạng số
          );
          console.log(`Cart items cleared for user ${buyerId}.`);
        } else {
          console.error(
            `IPN Error: Invalid buyer_id (${order.buyer_id}) for Order ${orderId}. Cannot clear cart.`
          );
        }
      }

      // 6. Phản hồi thành công cho VNPay
      console.log(`IPN Processed Successfully for Order ${orderId}`);
      res.json({ RspCode: "00", Message: "Confirm Success" });
    } catch (dbError) {
      console.error(`IPN DB Error for Order ${orderId}:`, dbError);
      res.json({ RspCode: "99", Message: "Unknown error" }); // Lỗi hệ thống khi tương tác DB
    }
  } else {
    console.error(`IPN Checksum FAILED for Order ID: ${orderId}`);
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
    10: "Thẻ/Tài khoản xác thực không thành công.", // Sửa key thành string "10"
    11: "Giao dịch chờ xác nhận OTP.", // Sửa key thành string "11"
    12: "Thẻ/Tài khoản hết hạn.", // Sửa key thành string "12"
    13: "Nhập sai OTP quá số lần quy định.", // Sửa key thành string "13"
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
  body("orderId").isInt({ min: 1 }).withMessage("ID đơn hàng không hợp lệ"),
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
router.get("/vnpay_return", vnpayReturn); // VNPay gọi bằng GET
router.get("/vnpay_ipn", vnpayIpn); // VNPay gọi bằng GET

export default router;
