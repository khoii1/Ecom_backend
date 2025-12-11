import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import helmet from "helmet";
dotenv.config();

// Import logger trước để dùng
import { logger } from "./utils/logger.js";

// Kiểm tra các biến môi trường bắt buộc khi khởi động
const requiredEnvVars = ["JWT_ACCESS_SECRET", "MONGODB_URI"];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  logger.error(
    "SERVER",
    `Thiếu các biến môi trường bắt buộc: ${missingVars.join(", ")}`
  );
  logger.error(
    "SERVER",
    "Vui lòng kiểm tra file .env và đảm bảo các biến sau đã được cấu hình:"
  );
  missingVars.forEach((varName) => {
    logger.error("SERVER", `   - ${varName}`);
  });
  process.exit(1);
}

logger.info("SERVER", "Tất cả biến môi trường bắt buộc đã được cấu hình");

// Kết nối MongoDB
import { connectDatabase } from "./config/database.js";
connectDatabase().catch((err) => {
  logger.error("DATABASE", `Không thể kết nối MongoDB: ${err.message}`);
  process.exit(1);
});

import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";

// --- Import các routes ---
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import storeRoutes from "./routes/store.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import cartItemRoutes from "./routes/cart_item.routes.js";
import orderItemRoutes from "./routes/order_item.routes.js";
import passwordResetTokenRoutes from "./routes/password_reset_token.routes.js";
import vnpayRoutes from "./routes/vnpay.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import discountRoutes from "./routes/discount.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import addressRoutes from "./routes/address.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import productVariantRoutes from "./routes/product_variant.routes.js";
import bannerRoutes from "./routes/banner.routes.js";
import shipperRoutes from "./routes/shipper.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import returnRoutes from "./routes/return.routes.js";
import walletRoutes from "./routes/wallet.routes.js";

// Import reservation scheduler
import { startReservationScheduler } from "./services/reservation.service.js";

const app = express();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middleware - Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "https://sandbox.vnpayment.vn"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Logging middleware - Đặt đầu tiên để catch mọi request
app.use((req, res, next) => {
  // Log tất cả requests (trừ static assets như .css, .js, .png, etc)
  const isStaticAsset =
    /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i.test(req.path);

  if (!isStaticAsset) {
    const origin = req.headers.origin || "no-origin";
    logger.info(
      "REQUEST",
      `${req.method} ${req.originalUrl || req.url} | Origin: ${origin}`
    );
  }
  next();
});

// Global middleware
app.use(corsMiddleware);
app.use(requestLogger); // Ghi log cho tất cả HTTP requests
// Middleware express.json() và urlencoded() sẽ được đặt SAU cấu hình webhook

// Serve favicon.ico trước (để tránh 401 error)
app.get("/favicon.ico", (req, res) => {
  res.status(204).end(); // No Content - trả về response rỗng
});

// Serve static files for admin panel (trước các routes khác để tránh middleware authentication)
app.use(
  "/admin",
  express.static(path.join(__dirname, "../public/admin"), {
    setHeaders: (res, filePath) => {
      // Không yêu cầu authentication cho static files
      if (
        filePath.endsWith(".ico") ||
        filePath.endsWith(".css") ||
        filePath.endsWith(".js") ||
        filePath.endsWith(".png") ||
        filePath.endsWith(".jpg") ||
        filePath.endsWith(".svg")
      ) {
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
    },
  })
);

// Health check endpoint
app.get("/", (req, res) =>
  res.json({
    ok: true,
    message: "Ecommerce Backend API",
    timestamp: new Date().toISOString(),
  })
);

// Middleware parsing JSON/URL-encoded cho các request khác (Đặt SAU webhook nếu có)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// API routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/stores", storeRoutes);
app.use("/categories", categoryRoutes);
app.use("/products", productRoutes);
app.use("/cart", cartRoutes);
app.use("/orders", orderRoutes);
app.use("/cart-items", cartItemRoutes);
app.use("/order-items", orderItemRoutes);
app.use("/password-reset-tokens", passwordResetTokenRoutes);
app.use("/payment/vnpay", vnpayRoutes);
app.use("/reviews", reviewRoutes);
app.use("/discounts", discountRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/addresses", addressRoutes);
app.use("/notifications", notificationRoutes);
app.use("/", productVariantRoutes);
app.use("/banners", bannerRoutes);
app.use("/shipper", shipperRoutes);
app.use("/conversations", chatRoutes);
app.use("/returns", returnRoutes);
app.use("/wallet", walletRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Tạo HTTP server để hỗ trợ Socket.io
const httpServer = createServer(app);

// Khởi tạo Socket.io
import { initializeSocket } from "./socket/chat.socket.js";
initializeSocket(httpServer);

const port = process.env.PORT || 8080;
httpServer.listen(port, () => {
  logger.info("SERVER", `Server đang chạy tại http://localhost:${port}`);
  logger.info(
    "SERVER",
    `Admin Panel: http://localhost:${port}/admin/login.html`
  );
  logger.info("SERVER", `Socket.io đã được khởi tạo`);

  // Khởi động reservation scheduler
  startReservationScheduler();
});
