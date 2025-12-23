import { logger } from "../utils/logger.js";

let io;

export function initOrderSocket(socketIO) {
  io = socketIO;
  logger.info("Socket", "Order socket handlers initialized");
}

/**
 * Emit order created event đến seller
 * @param {string} storeId - ID của store nhận order
 * @param {object} orderData - Dữ liệu order mới
 */
export function emitOrderCreated(storeId, orderData) {
  if (!io) {
    logger.error("Socket", "Socket.IO chưa được khởi tạo");
    return;
  }

  // Emit đến room của store
  io.to(`store:${storeId}`).emit("order:created", orderData);
  logger.info("Socket", `Emitted order:created to store ${storeId}`, {
    orderId: orderData.id,
    orderCode: orderData.code,
  });
}

/**
 * Emit order status updated event
 * @param {string} orderId - ID của order
 * @param {string} buyerId - ID của buyer
 * @param {string} storeId - ID của store
 * @param {object} orderData - Dữ liệu order đã update
 */
export function emitOrderUpdated(orderId, buyerId, storeId, orderData) {
  if (!io) {
    logger.error("Socket", "Socket.IO chưa được khởi tạo");
    return;
  }

  // Emit đến buyer
  io.to(`user:${buyerId}`).emit("order:updated", orderData);

  // Emit đến store/seller
  io.to(`store:${storeId}`).emit("order:updated", orderData);

  logger.info("Socket", `Emitted order:updated for order ${orderId}`, {
    orderCode: orderData.code,
    status: orderData.status,
  });
}
