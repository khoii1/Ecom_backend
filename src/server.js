import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// --- SỬA: Import thêm các routes ---
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
// --- KẾT THÚC SỬA ---

const app = express();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global middleware
app.use(corsMiddleware);
// Middleware express.json() và urlencoded() sẽ được đặt SAU cấu hình webhook

// Serve static files for admin panel
app.use("/admin", express.static(path.join(__dirname, "../public/admin")));

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

app.use(notFoundHandler);
app.use(errorHandler);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
  console.log(`Admin Panel: http://localhost:${port}/admin/login.html`);
});
