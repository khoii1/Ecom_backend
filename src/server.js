import express from "express";
import dotenv from "dotenv";
dotenv.config();

import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import storeRoutes from "./routes/store.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import cartItemRoutes from "./routes/cart_item.routes.js";
import orderItemRoutes from "./routes/order_item.routes.js";
import authTokenRoutes from "./routes/auth_token.routes.js";
import passwordResetTokenRoutes from "./routes/password_reset_token.routes.js";

const app = express();

// Global middleware
app.use(corsMiddleware);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/", (req, res) =>
  res.json({
    ok: true,
    message: "Ecommerce Backend API",
    timestamp: new Date().toISOString(),
  })
);

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
app.use("/auth-tokens", authTokenRoutes);
app.use("/password-reset-tokens", passwordResetTokenRoutes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

const port = process.env.PORT || 8080;
app.listen(port, () =>
  console.log(`Server đang chạy tại http://localhost:${port}`)
);
