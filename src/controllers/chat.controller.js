import { ConversationModel } from "../models/conversation.model.js";
import { MessageModel } from "../models/message.model.js";
import { StoreModel } from "../models/store.model.js";
import { ProductModel } from "../models/product.model.js";
import { handle } from "./base.controller.js";
import { logger } from "../utils/logger.js";
import { emitNewMessage, emitConversationUpdate } from "../socket/chat.socket.js";

export const ChatController = {
  // GET /conversations - Lấy danh sách conversations của user
  getConversations: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const userRole = req.currentUser.role;

    const conversations = await ConversationModel.findByUser(userId, userRole);

    const result = conversations.map((conv) => {
      const otherUser = userRole === "SELLER" ? conv.buyer_id : conv.seller_id;
      const unreadCount = userRole === "SELLER" 
        ? conv.seller_unread_count 
        : conv.buyer_unread_count;

      return {
        id: conv._id.toString(),
        buyer_id: conv.buyer_id._id.toString(),
        seller_id: conv.seller_id._id.toString(),
        store_id: conv.store_id._id.toString(),
        store_name: conv.store_id.name,
        other_user: {
          id: otherUser._id.toString(),
          name: otherUser.full_name,
          email: otherUser.email,
        },
        product: conv.product_id ? {
          id: conv.product_id._id.toString(),
          title: conv.product_id.title,
          image_url: conv.product_id.image_url,
        } : null,
        last_message: conv.last_message,
        last_message_at: conv.last_message_at 
          ? conv.last_message_at.toISOString() 
          : null,
        unread_count: unreadCount,
        created_at: conv.createdAt ? conv.createdAt.toISOString() : null,
        updated_at: conv.updatedAt ? conv.updatedAt.toISOString() : null,
      };
    });

    res.json(result);
  }),

  // POST /conversations - Tạo conversation mới
  createConversation: handle(async (req, res) => {
    const userId = req.currentUser.id;
    const { store_id, product_id, order_id } = req.body;

    // Kiểm tra store tồn tại
    const store = await StoreModel.findById(store_id).lean();
    if (!store) {
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    }

    // Kiểm tra quyền: chỉ buyer mới tạo conversation
    if (req.currentUser.role === "SELLER") {
      return res.status(403).json({ 
        message: "Người bán không thể tạo conversation. Hãy đợi khách hàng liên hệ." 
      });
    }

    // Kiểm tra product nếu có
    if (product_id) {
      const product = await ProductModel.findById(product_id).lean();
      if (!product || product.store_id.toString() !== store_id) {
        return res.status(400).json({ 
          message: "Sản phẩm không thuộc cửa hàng này" 
        });
      }
    }

    // Tìm hoặc tạo conversation
    const conversation = await ConversationModel.findOrCreate({
      buyer_id: userId,
      seller_id: store.owner_id,
      store_id: store_id,
      product_id: product_id || null,
      order_id: order_id || null,
    });

    // Populate để trả về đầy đủ thông tin
    const populated = await ConversationModel.findById(conversation._id)
      .populate("buyer_id", "full_name email")
      .populate("seller_id", "full_name email")
      .populate("store_id", "name")
      .populate("product_id", "title image_url")
      .lean();

    const otherUser = populated.seller_id;

    res.status(201).json({
      id: populated._id.toString(),
      buyer_id: populated.buyer_id._id.toString(),
      seller_id: populated.seller_id._id.toString(),
      store_id: populated.store_id._id.toString(),
      store_name: populated.store_id.name,
      other_user: {
        id: otherUser._id.toString(),
        name: otherUser.full_name,
        email: otherUser.email,
      },
      product: populated.product_id ? {
        id: populated.product_id._id.toString(),
        title: populated.product_id.title,
        image_url: populated.product_id.image_url,
      } : null,
      last_message: populated.last_message,
      last_message_at: populated.last_message_at 
        ? populated.last_message_at.toISOString() 
        : null,
      unread_count: 0,
      created_at: populated.createdAt ? populated.createdAt.toISOString() : null,
      updated_at: populated.updatedAt ? populated.updatedAt.toISOString() : null,
    });
  }),

  // GET /conversations/:id/messages - Lấy messages của conversation
  getMessages: handle(async (req, res) => {
    const conversationId = req.params.id;
    const userId = req.currentUser.id;
    const limit = parseInt(req.query.limit) || 50;

    // Kiểm tra conversation tồn tại và user có quyền truy cập
    const conversation = await ConversationModel.findById(conversationId).lean();
    if (!conversation) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện" });
    }

    if (
      conversation.buyer_id.toString() !== userId.toString() &&
      conversation.seller_id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ 
        message: "Bạn không có quyền truy cập cuộc trò chuyện này" 
      });
    }

    // Kiểm tra conversation đã bị xóa bởi user hiện tại
    const userIdStr = userId.toString();
    if (conversation.deleted_by && 
        conversation.deleted_by.some(id => id.toString() === userIdStr)) {
      return res.status(404).json({ 
        message: "Cuộc trò chuyện này đã bị xóa" 
      });
    }

    // Xác định last_visible_at dựa trên role của user
    const userRole = req.currentUser.role;
    const lastVisibleAt = userRole === "SELLER" 
      ? conversation.seller_last_visible_at 
      : conversation.buyer_last_visible_at;

    // Lấy messages - chỉ lấy messages sau last_visible_at (nếu có)
    let messages;
    if (lastVisibleAt) {
      // Chỉ lấy messages sau hoặc bằng thời điểm last_visible_at (dùng $gte để đảm bảo lấy được tin nhắn mới nhất)
      messages = await MessageModel.find({
        conversation_id: conversationId,
        createdAt: { $gte: lastVisibleAt },
      })
        .populate("sender_id", "full_name email")
        .populate("product_id", "title image_url price")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } else {
      // Nếu không có last_visible_at, lấy tất cả messages
      messages = await MessageModel.findByConversation(conversationId, limit);
    }

    // Đánh dấu đã đọc
    await MessageModel.markAsRead(conversationId, userId);

    // Cập nhật unread count (userRole đã được khai báo ở trên)
    const updateField = userRole === "SELLER" 
      ? { seller_unread_count: 0 }
      : { buyer_unread_count: 0 };
    
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: updateField,
    });

    res.json(
      messages
        .reverse() // Đảo ngược để hiển thị từ cũ đến mới
        .map((msg) => {
          const messageData = {
            id: msg._id.toString(),
            conversation_id: msg.conversation_id.toString(),
            sender_id: msg.sender_id._id.toString(),
            sender_name: msg.sender_id.full_name,
            message: msg.message,
            message_type: msg.message_type,
            image_url: msg.image_url,
            is_read: msg.is_read,
            read_at: msg.read_at ? msg.read_at.toISOString() : null,
            created_at: msg.createdAt ? msg.createdAt.toISOString() : null,
          };

          // Thêm thông tin sản phẩm nếu có
          if (msg.product_id) {
            messageData.product_id = msg.product_id._id.toString();
            messageData.product = {
              id: msg.product_id._id.toString(),
              title: msg.product_id.title,
              image_url: msg.product_id.image_url,
              price: msg.product_id.price,
            };
          }

          return messageData;
        })
    );
  }),

  // POST /conversations/:id/messages - Gửi message
  sendMessage: handle(async (req, res) => {
    const conversationId = req.params.id;
    const userId = req.currentUser.id;
    const { message = "", message_type = "text", image_url, product_id } = req.body;

    // Phải có ít nhất message, image_url hoặc product_id
    if ((!message || message.trim().length === 0) && !image_url && !product_id) {
      return res.status(400).json({ 
        message: "Tin nhắn, ảnh hoặc sản phẩm phải có ít nhất một" 
      });
    }

    // Kiểm tra conversation tồn tại và user có quyền
    const conversation = await ConversationModel.findById(conversationId).lean();
    if (!conversation) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện" });
    }

    if (
      conversation.buyer_id.toString() !== userId.toString() &&
      conversation.seller_id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ 
        message: "Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này" 
      });
    }

    // Kiểm tra conversation đã bị xóa bởi user hiện tại (người gửi)
    const userIdStr = userId.toString();
    if (conversation.deleted_by && 
        conversation.deleted_by.some(id => id.toString() === userIdStr)) {
      return res.status(404).json({ 
        message: "Cuộc trò chuyện này đã bị xóa. Không thể gửi tin nhắn." 
      });
    }

    // Xác định người nhận và kiểm tra nếu conversation đã bị xóa bởi người nhận
    const isBuyer = conversation.buyer_id.toString() === userIdStr;
    const recipientId = isBuyer ? conversation.seller_id : conversation.buyer_id;
    const recipientIdStr = recipientId.toString();
    const isDeletedByRecipient = conversation.deleted_by && 
        conversation.deleted_by.some(id => id.toString() === recipientIdStr);

    // Nếu gửi sản phẩm, kiểm tra product tồn tại và thuộc store của conversation
    if (product_id) {
      const { ProductModel } = await import("../models/product.model.js");
      
      const product = await ProductModel.findById(product_id).lean();
      if (!product) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }
      
      if (product.store_id.toString() !== conversation.store_id.toString()) {
        return res.status(403).json({ 
          message: "Sản phẩm không thuộc cửa hàng này" 
        });
      }
    }

    // Tạo message
    const newMessage = await MessageModel.create({
      conversation_id: conversationId,
      sender_id: userId,
      message: message?.trim() || (image_url ? "[Ảnh]" : (product_id ? "[Sản phẩm]" : "")),
      message_type: image_url ? "image" : (product_id ? "product" : message_type),
      image_url: image_url || null,
      product_id: product_id || null,
    });

    // Populate sender
    await newMessage.populate("sender_id", "full_name email");

    // Cập nhật conversation
    let lastMessageText = message?.trim() || "";
    if (image_url) {
      lastMessageText = "[Ảnh]";
    } else if (product_id) {
      lastMessageText = "[Sản phẩm]";
    }
    
    const now = new Date();
    const updateData = {
      last_message: lastMessageText,
      last_message_at: now,
      last_message_by: userId,
    };

    // Tăng unread count cho người nhận
    if (isBuyer) {
      updateData.seller_unread_count = (conversation.seller_unread_count || 0) + 1;
    } else {
      updateData.buyer_unread_count = (conversation.buyer_unread_count || 0) + 1;
    }

    // Nếu conversation đã bị xóa bởi người nhận, restore nó
    // và set last_visible_at = thời điểm trước tin nhắn mới một chút (để đảm bảo lấy được message khi dùng $gte)
    if (isDeletedByRecipient) {
      // Lấy thời điểm tạo message (có thể hơi khác với now)
      const messageTime = newMessage.createdAt || now;
      // Trừ 1 giây để đảm bảo khi query với $gte sẽ lấy được message này
      const visibleAt = new Date(messageTime.getTime() - 1000);
      
      // Set last_visible_at của người nhận = thời điểm trước tin nhắn mới
      // Để khi họ mở lại conversation, chỉ thấy tin nhắn mới từ thời điểm này
      if (isBuyer) {
        // Người nhận là seller
        updateData.seller_last_visible_at = visibleAt;
      } else {
        // Người nhận là buyer
        updateData.buyer_last_visible_at = visibleAt;
      }
    }

    // Update conversation với $set
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: updateData,
    });

    // Nếu cần restore (remove khỏi deleted_by), thực hiện riêng
    if (isDeletedByRecipient) {
      await ConversationModel.findByIdAndUpdate(conversationId, {
        $pull: { deleted_by: recipientId },
      });
    }

    // Populate product nếu có
    if (product_id) {
      await newMessage.populate("product_id", "title image_url price");
    }

    const responseData = {
      id: newMessage._id.toString(),
      conversation_id: newMessage.conversation_id.toString(),
      sender_id: newMessage.sender_id._id.toString(),
      sender_name: newMessage.sender_id.full_name,
      message: newMessage.message,
      message_type: newMessage.message_type,
      image_url: newMessage.image_url,
      is_read: newMessage.is_read,
      created_at: newMessage.createdAt ? newMessage.createdAt.toISOString() : null,
    };

    if (product_id && newMessage.product_id) {
      responseData.product_id = newMessage.product_id._id.toString();
      responseData.product = {
        id: newMessage.product_id._id.toString(),
        title: newMessage.product_id.title,
        image_url: newMessage.product_id.image_url,
        price: newMessage.product_id.price,
      };
    }

    // Emit real-time event cho tin nhắn mới
    emitNewMessage(conversationId, responseData);

    // Emit conversation update (truyền buyerId và sellerId để emit đến user rooms)
    emitConversationUpdate(
      conversationId,
      {
        id: conversationId,
        last_message: lastMessageText,
        last_message_at: updateData.last_message_at.toISOString(),
        last_message_by: userId,
        buyer_unread_count: updateData.buyer_unread_count || conversation.buyer_unread_count || 0,
        seller_unread_count: updateData.seller_unread_count || conversation.seller_unread_count || 0,
      },
      conversation.buyer_id.toString(),
      conversation.seller_id.toString()
    );

    res.status(201).json(responseData);
  }),

  // GET /conversations/:id - Lấy chi tiết conversation
  getConversation: handle(async (req, res) => {
    const conversationId = req.params.id;
    const userId = req.currentUser.id;

    const conversation = await ConversationModel.findById(conversationId)
      .populate("buyer_id", "full_name email")
      .populate("seller_id", "full_name email")
      .populate("store_id", "name")
      .populate("product_id", "title image_url")
      .lean();

    if (!conversation) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện" });
    }

    if (
      conversation.buyer_id._id.toString() !== userId.toString() &&
      conversation.seller_id._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ 
        message: "Bạn không có quyền truy cập cuộc trò chuyện này" 
      });
    }

    const userRole = req.currentUser.role;
    const otherUser = userRole === "SELLER" 
      ? conversation.buyer_id 
      : conversation.seller_id;
    const unreadCount = userRole === "SELLER" 
      ? conversation.seller_unread_count 
      : conversation.buyer_unread_count;

    res.json({
      id: conversation._id.toString(),
      buyer_id: conversation.buyer_id._id.toString(),
      seller_id: conversation.seller_id._id.toString(),
      store_id: conversation.store_id._id.toString(),
      store_name: conversation.store_id.name,
      other_user: {
        id: otherUser._id.toString(),
        name: otherUser.full_name,
        email: otherUser.email,
      },
      product: conversation.product_id ? {
        id: conversation.product_id._id.toString(),
        title: conversation.product_id.title,
        image_url: conversation.product_id.image_url,
      } : null,
      last_message: conversation.last_message,
      last_message_at: conversation.last_message_at 
        ? conversation.last_message_at.toISOString() 
        : null,
      unread_count: unreadCount,
      created_at: conversation.createdAt ? conversation.createdAt.toISOString() : null,
      updated_at: conversation.updatedAt ? conversation.updatedAt.toISOString() : null,
    });
  }),

  // DELETE /conversations/:id - Xóa cuộc hội thoại (soft delete - chỉ xóa ở phía người dùng)
  deleteConversation: handle(async (req, res) => {
    const conversationId = req.params.id;
    const userId = req.currentUser.id;

    // Kiểm tra conversation tồn tại và user có quyền truy cập
    const conversation = await ConversationModel.findById(conversationId).lean();
    if (!conversation) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện" });
    }

    if (
      conversation.buyer_id.toString() !== userId.toString() &&
      conversation.seller_id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ 
        message: "Bạn không có quyền xóa cuộc trò chuyện này" 
      });
    }

    // Kiểm tra đã bị xóa chưa
    const userIdStr = userId.toString();
    if (conversation.deleted_by && 
        conversation.deleted_by.some(id => id.toString() === userIdStr)) {
      return res.status(400).json({ 
        message: "Cuộc trò chuyện đã bị xóa" 
      });
    }

    // Xác định user role để lưu last_visible_at đúng
    const isBuyer = conversation.buyer_id.toString() === userIdStr;
    const now = new Date();
    
    // Soft delete: thêm userId vào mảng deleted_by và lưu thời điểm xóa
    const updateData = {
      $addToSet: { deleted_by: userId },
    };
    
    // Lưu thời điểm tin nhắn cuối cùng mà user thấy trước khi xóa
    // Nếu có last_message_at thì dùng nó, không thì dùng thời điểm hiện tại
    const lastVisibleAt = conversation.last_message_at || now;
    if (isBuyer) {
      updateData.$set = { buyer_last_visible_at: lastVisibleAt };
    } else {
      updateData.$set = { seller_last_visible_at: lastVisibleAt };
    }
    
    await ConversationModel.findByIdAndUpdate(conversationId, updateData);

    res.json({ 
      message: "Đã xóa cuộc trò chuyện thành công",
      id: conversationId,
    });
  }),
};

