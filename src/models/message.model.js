import { mongoose } from "../config/database.js";

const messageSchema = new mongoose.Schema(
  {
    conversation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: function() {
        // Message chỉ required nếu không có image_url
        return !this.image_url;
      },
      trim: true,
      maxlength: 2000,
      default: '',
    },
    message_type: {
      type: String,
      enum: ["text", "image", "system", "product"],
      default: "text",
    },
    image_url: {
      type: String,
      default: null,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    is_read: {
      type: Boolean,
      default: false,
    },
    read_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
messageSchema.index({ conversation_id: 1, createdAt: -1 });
messageSchema.index({ sender_id: 1 });
messageSchema.index({ is_read: 1 });

// Static methods
messageSchema.statics.findByConversation = async function (conversationId, limit = 50) {
  return await this.find({ conversation_id: conversationId })
    .populate("sender_id", "full_name email")
    .populate("product_id", "title image_url price")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

messageSchema.statics.markAsRead = async function (conversationId, userId) {
  return await this.updateMany(
    {
      conversation_id: conversationId,
      sender_id: { $ne: userId },
      is_read: false,
    },
    {
      $set: {
        is_read: true,
        read_at: new Date(),
      },
    }
  );
};

export const MessageModel = mongoose.model("Message", messageSchema);

