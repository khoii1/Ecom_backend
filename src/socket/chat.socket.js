import { Server } from "socket.io";
import { logger } from "../utils/logger.js";
import jwt from "jsonwebtoken";
import { initOrderSocket } from "./order.socket.js";

let io;

export function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*", // Trong production nên config cụ thể
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Middleware để authenticate user
  io.use(async (socket, next) => {
    try {
      // Lấy token từ auth object hoặc query
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      // Verify JWT token
      const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
      if (!JWT_ACCESS_SECRET) {
        return next(
          new Error("Authentication error: JWT secret not configured")
        );
      }

      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
      socket.userId = decoded.sub; // MongoDB ObjectId as string
      socket.userRole = decoded.role;
      socket.storeId = decoded.storeId; // Store ID nếu là seller
      next();
    } catch (err) {
      logger.error("Socket", `Authentication error: ${err.message}`);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(
      "Socket",
      `User connected: ${socket.userId} (${socket.userRole})`
    );

    // Tự động join vào room riêng của user để nhận conversation updates
    socket.join(`user:${socket.userId}`);
    logger.info("Socket", `User ${socket.userId} joined user room`);

    // Nếu là seller, join vào room của store
    if (socket.userRole === "SELLER" && socket.storeId) {
      socket.join(`store:${socket.storeId}`);
      logger.info(
        "Socket",
        `Seller ${socket.userId} joined store room: ${socket.storeId}`
      );
    }

    // Join room theo conversationId
    socket.on("join_conversation", (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      logger.info(
        "Socket",
        `User ${socket.userId} joined conversation ${conversationId}`
      );
    });

    // Leave room
    socket.on("leave_conversation", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      logger.info(
        "Socket",
        `User ${socket.userId} left conversation ${conversationId}`
      );
    });

    socket.on("disconnect", () => {
      logger.info("Socket", `User disconnected: ${socket.userId}`);
    });

    socket.on("error", (error) => {
      logger.error(
        "Socket",
        `Socket error for user ${socket.userId}: ${error}`
      );
    });
  });

  // Initialize order socket handlers
  initOrderSocket(io);
  logger.info("Socket", "Order socket handlers initialized");

  return io;
}

// Function để emit message mới
export function emitNewMessage(conversationId, message) {
  if (io) {
    io.to(`conversation:${conversationId}`).emit("new_message", message);
    logger.info(
      "Socket",
      `Emitted new_message to conversation ${conversationId}`
    );
  }
}

// Function để emit message đã đọc
export function emitMessageRead(conversationId, userId) {
  if (io) {
    io.to(`conversation:${conversationId}`).emit("message_read", {
      conversationId,
      userId,
    });
    logger.info(
      "Socket",
      `Emitted message_read to conversation ${conversationId}`
    );
  }
}

// Function để emit conversation update (khi có tin nhắn mới)
export function emitConversationUpdate(
  conversationId,
  conversationData,
  buyerId,
  sellerId
) {
  if (io) {
    // Emit đến room conversation (cho những người đang xem conversation)
    io.to(`conversation:${conversationId}`).emit(
      "conversation_update",
      conversationData
    );

    // Emit đến room của buyer và seller (để cập nhật trong chat list)
    if (buyerId) {
      io.to(`user:${buyerId}`).emit("conversation_update", conversationData);
    }
    if (sellerId) {
      io.to(`user:${sellerId}`).emit("conversation_update", conversationData);
    }

    logger.info(
      "Socket",
      `Emitted conversation_update to conversation ${conversationId} and user rooms`
    );
  }
}
