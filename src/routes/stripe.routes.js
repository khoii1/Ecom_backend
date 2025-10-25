import { Router } from "express";
import Stripe from "stripe"; // Import thư viện stripe
import express from "express"; // Import express để dùng raw body parser
import { authentication } from "../middleware/authentication.js"; // Middleware xác thực user
import { OrderModel } from "../models/order.model.js"; // Model Order của bạn
import { handle } from "../controllers/base.controller.js"; // Hàm handle error
import { databasePool } from "../config/database.js"; // Import databasePool

const router = Router();

// --- Khởi tạo Stripe ---
// ... (Khởi tạo Stripe giữ nguyên) ...
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// --- Endpoint 1: Tạo PaymentIntent ---
// ... (create-payment-intent giữ nguyên) ...

// --- Endpoint 2: Nhận Webhook từ Stripe ---
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handle(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // ... (Xác thực chữ ký giữ nguyên) ...

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Xử lý sự kiện webhook
    try {
      switch (event.type) {
        case "payment_intent.succeeded":
          const paymentIntentSucceeded = event.data.object;
          const orderId = paymentIntentSucceeded.metadata.order_id;
          const userId = paymentIntentSucceeded.metadata.user_id; // ID người dùng
          const stripePaymentIntentId = paymentIntentSucceeded.id;

          if (orderId && orderId !== "N/A") {
            // 1. Cập nhật trạng thái đơn hàng trong Database
            const updatedOrder = await OrderModel.updateById(orderId, {
              status: "paid", // Cập nhật trạng thái
            });

            if (updatedOrder) {
              console.log(`Order ${orderId} status updated to paid.`);

              // 2. Xóa cart items của người dùng (Giỏ hàng của user)
              if (userId) {
                const numericUserId = parseInt(userId, 10);
                console.log(`Clearing cart items for user ${numericUserId}...`);
                await databasePool.query(
                  `
                          DELETE FROM cart_items
                          WHERE cart_id IN (
                              SELECT id FROM carts WHERE user_id = $1
                          )
                      `,
                  [numericUserId]
                );
                console.log(`Cart items cleared for user ${userId}.`);
              } else {
                console.warn(
                  `Webhook: Missing user_id metadata for clearing cart.`
                );
              }
            } else {
              console.error(
                `Webhook Error: Could not find or update order ${orderId}.`
              );
              return res.status(500).json({ error: "Order update failed." });
            }
          } else {
            console.warn(
              "Webhook Warning: payment_intent.succeeded received without a valid order_id."
            );
          }
          break;

        case "payment_intent.payment_failed":
          const paymentIntentFailed = event.data.object;
          const failedOrderId = paymentIntentFailed.metadata.order_id;
          console.log(
            `PaymentIntent failed for order ${failedOrderId || "N/A"}.`
          );
          if (failedOrderId && failedOrderId !== "N/A") {
            // Cập nhật trạng thái đơn hàng thành 'payment_failed' (tùy chọn)
            await OrderModel.updateById(failedOrderId, {
              status: "payment_failed",
            });
            console.log(
              `Order ${failedOrderId} status updated to payment_failed.`
            );
          }
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      // Phản hồi thành công cho Stripe
      res.json({ received: true });
    } catch (error) {
      console.error("Error handling webhook event:", error);
      // Trả về lỗi 500 nếu xử lý DB thất bại để Stripe thử gửi lại webhook
      res.status(500).json({ error: "Webhook handler failed." });
    }
  })
);

export default router;
