import { mongoose } from "../config/database.js";

const conversationSchema = new mongoose.Schema(
  {
    buyer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    seller_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    last_message: {
      type: String,
      default: null,
    },
    last_message_at: {
      type: Date,
      default: null,
    },
    last_message_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    buyer_unread_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    seller_unread_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    deleted_by: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // Thời điểm tin nhắn cuối cùng mà buyer thấy (để chỉ hiển thị tin nhắn mới sau khi restore)
    buyer_last_visible_at: {
      type: Date,
      default: null,
    },
    // Thời điểm tin nhắn cuối cùng mà seller thấy (để chỉ hiển thị tin nhắn mới sau khi restore)
    seller_last_visible_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
conversationSchema.index({ buyer_id: 1 });
conversationSchema.index({ seller_id: 1 });
conversationSchema.index({ store_id: 1 });
conversationSchema.index({ buyer_id: 1, seller_id: 1, store_id: 1 });
conversationSchema.index({ last_message_at: -1 });
conversationSchema.index({ deleted_by: 1 });

// Static methods
conversationSchema.statics.findOrCreate = async function (data) {
  const { buyer_id, seller_id, store_id, order_id, product_id } = data;

  // Tìm conversation đã tồn tại (kể cả đã bị xóa)
  let conversation = await this.findOne({
    buyer_id,
    seller_id,
    store_id,
    is_active: true,
  }).lean();

  if (conversation) {
    // Kiểm tra nếu conversation đã bị xóa bởi buyer hoặc seller
    const buyerIdStr = buyer_id.toString();
    const sellerIdStr = seller_id.toString();
    const deletedByBuyer = conversation.deleted_by && 
      conversation.deleted_by.some(id => id.toString() === buyerIdStr);
    const deletedBySeller = conversation.deleted_by && 
      conversation.deleted_by.some(id => id.toString() === sellerIdStr);
    
    // Nếu conversation đã bị xóa bởi buyer hoặc seller, restore nó
    if (deletedByBuyer || deletedBySeller) {
      const now = new Date();
      const updateData = {};
      
      // Restore conversation: remove khỏi deleted_by
      const userIdsToRemove = [];
      if (deletedByBuyer) {
        userIdsToRemove.push(buyer_id);
        // Set buyer_last_visible_at = thời điểm hiện tại (để chỉ thấy tin nhắn mới)
        updateData.buyer_last_visible_at = now;
      }
      if (deletedBySeller) {
        userIdsToRemove.push(seller_id);
        // Set seller_last_visible_at = thời điểm hiện tại (để chỉ thấy tin nhắn mới)
        updateData.seller_last_visible_at = now;
      }
      
      // Update conversation
      await this.findByIdAndUpdate(conversation._id, {
        $pull: { deleted_by: { $in: userIdsToRemove } },
        $set: updateData,
      });
      
      // Reload conversation sau khi restore
      conversation = await this.findById(conversation._id).lean();
    }
    
    return conversation;
  }

  // Tạo conversation mới
  conversation = await this.create({
    buyer_id,
    seller_id,
    store_id,
    order_id: order_id || null,
    product_id: product_id || null,
  });

  return conversation.toObject();
};

conversationSchema.statics.findByUser = async function (userId, role) {
  const query = role === "SELLER" 
    ? { seller_id: userId, is_active: true }
    : { buyer_id: userId, is_active: true };

  // Filter conversations đã bị xóa bởi user hiện tại (deleted_by là mảng)
  query.deleted_by = { $nin: [userId] };

  return await this.find(query)
    .populate("buyer_id", "full_name email")
    .populate("seller_id", "full_name email")
    .populate("store_id", "name")
    .populate("product_id", "title image_url")
    .sort({ last_message_at: -1, updatedAt: -1 })
    .lean();
};

export const ConversationModel = mongoose.model("Conversation", conversationSchema);

