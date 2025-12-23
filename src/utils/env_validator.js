/**
 * Validate environment variables khi khởi động server
 * Đảm bảo tất cả biến môi trường cần thiết đã được cấu hình
 */

export function validateEnv() {
  const requiredVars = [
    // Server
    "PORT",
    "NODE_ENV",

    // Database
    "MONGODB_URI",

    // JWT
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "JWT_ACCESS_EXPIRES",
    "JWT_REFRESH_EXPIRES",

    // SendGrid Email
    "SENDGRID_API_KEY",
    "SENDGRID_FROM_EMAIL",
    "SENDGRID_FROM_NAME",

    // Cloudinary
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",

    // VNPay
    "VNP_TMNCODE",
    "VNP_HASHSECRET",
    "VNP_URL",
    "VNP_RETURNURL",

    // Frontend URL
    "FRONTEND_PAYMENT_REDIRECT_URL",
  ];

  const missing = [];
  const invalid = [];

  // Kiểm tra biến bị thiếu
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Kiểm tra format của một số biến quan trọng
  if (
    process.env.MONGODB_URI &&
    !process.env.MONGODB_URI.startsWith("mongodb")
  ) {
    invalid.push(
      "MONGODB_URI - Phải bắt đầu bằng mongodb:// hoặc mongodb+srv://"
    );
  }

  if (process.env.PORT && isNaN(parseInt(process.env.PORT))) {
    invalid.push("PORT - Phải là số");
  }

  if (
    process.env.NODE_ENV &&
    !["development", "production", "test"].includes(process.env.NODE_ENV)
  ) {
    invalid.push("NODE_ENV - Phải là development, production hoặc test");
  }

  if (
    process.env.SENDGRID_FROM_EMAIL &&
    !process.env.SENDGRID_FROM_EMAIL.includes("@")
  ) {
    invalid.push("SENDGRID_FROM_EMAIL - Email không hợp lệ");
  }

  if (process.env.VNP_URL && !process.env.VNP_URL.startsWith("http")) {
    invalid.push("VNP_URL - URL không hợp lệ");
  }

  // Throw error nếu có vấn đề
  if (missing.length > 0 || invalid.length > 0) {
    let errorMessage = "❌ LỖI CẤU HÌNH BIẾN MÔI TRƯỜNG:\n\n";

    if (missing.length > 0) {
      errorMessage += `📋 Các biến bị thiếu (${missing.length}):\n`;
      missing.forEach((v) => {
        errorMessage += `   - ${v}\n`;
      });
      errorMessage += "\n";
    }

    if (invalid.length > 0) {
      errorMessage += `⚠️  Các biến không hợp lệ (${invalid.length}):\n`;
      invalid.forEach((v) => {
        errorMessage += `   - ${v}\n`;
      });
      errorMessage += "\n";
    }

    errorMessage +=
      "💡 Vui lòng kiểm tra file .env và đảm bảo tất cả biến được cấu hình đúng.\n";
    errorMessage += "📝 Tham khảo file .env.example để xem cấu hình mẫu.\n";

    throw new Error(errorMessage);
  }

  // Log thông báo thành công
  console.log("✅ Đã validate tất cả biến môi trường thành công");
  console.log(`📌 Môi trường: ${process.env.NODE_ENV}`);
  console.log(`🌐 Port: ${process.env.PORT}`);
}

/**
 * Lấy giá trị env với giá trị mặc định
 */
export function getEnv(key, defaultValue = undefined) {
  return process.env[key] || defaultValue;
}

/**
 * Kiểm tra xem có phải môi trường production không
 */
export function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * Kiểm tra xem có phải môi trường development không
 */
export function isDevelopment() {
  return process.env.NODE_ENV === "development";
}

/**
 * Kiểm tra xem có phải môi trường test không
 */
export function isTest() {
  return process.env.NODE_ENV === "test";
}
