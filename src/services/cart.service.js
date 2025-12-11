import { CartModel } from "../models/cart.model.js";
import { CartItemModel } from "../models/cart_item.model.js";
import { ProductModel } from "../models/product.model.js";
import { mongoose } from "../config/database.js";

export const CartService = {
  async ensure(user_id) {
    let cart = await CartModel.findOne({ user_id }).lean();
    if (cart) return cart._id;

    cart = await CartModel.create({ user_id });
    return cart._id;
  },

  async getMyCart(user_id) {
    const cart_id = await this.ensure(user_id);

    // Lấy cart items với thông tin product
    const cartItems = await CartItemModel.find({ cart_id })
      .populate(
        "product_id",
        "title price discount_percentage image_url stock_quantity"
      )
      .lean();

    // Tính toán final_price và subtotal
    let subtotal = 0;
    const items = cartItems
      .map((item) => {
        const product = item.product_id;
        if (!product) return null;

        const price = parseFloat(product.price);
        const discount = parseFloat(product.discount_percentage || 0);
        const finalPrice =
          discount > 0 ? price - (price * discount) / 100 : price;

        subtotal += finalPrice * item.qty;

        return {
          id: item._id.toString(),
          product_id: product._id.toString(),
          qty: item.qty,
          title: product.title,
          price: price,
          discount_percentage: discount,
          final_price: finalPrice,
          image_url: product.image_url,
          stock_quantity: product.stock_quantity ?? 0,
        };
      })
      .filter(Boolean);

    return {
      cart_id: cart_id.toString(),
      items: items,
      subtotal: subtotal,
    };
  },

  async addItem(user_id, { product_id, qty }) {
    const cart_id = await this.ensure(user_id);

    // Kiểm tra sản phẩm và tồn kho
    const product = await ProductModel.findById(product_id).lean();
    if (!product) {
      throw new Error("Sản phẩm không tồn tại");
    }

    if (product.status !== "active") {
      throw new Error("Sản phẩm hiện không khả dụng");
    }

    // Kiểm tra tồn kho
    const requestedQty = Number(qty);
    const currentStock = product.stock_quantity ?? 0;

    if (currentStock <= 0) {
      throw new Error("Sản phẩm đã hết hàng");
    }

    // Tìm cart item đã tồn tại
    const existed = await CartItemModel.findOne({
      cart_id,
      product_id,
    }).lean();

    let totalRequestedQty = requestedQty;
    const currentQtyInCart = existed ? existed.qty : 0;

    if (existed) {
      totalRequestedQty = currentQtyInCart + requestedQty;
    }

    // Tính số lượng có sẵn (stock - reserved)
    const reservedQty = product.reserved_quantity ?? 0;
    const availableStock = Math.max(0, currentStock - reservedQty);

    if (totalRequestedQty > availableStock) {
      const maxCanAdd = availableStock - currentQtyInCart;
      if (currentQtyInCart > 0) {
        throw new Error(
          `Sản phẩm chỉ còn ${availableStock} sản phẩm có sẵn. Bạn đã có ${currentQtyInCart} sản phẩm trong giỏ, chỉ có thể thêm tối đa ${maxCanAdd} sản phẩm nữa.`
        );
      } else {
        throw new Error(
          `Sản phẩm chỉ còn ${availableStock} sản phẩm có sẵn. Bạn đang yêu cầu ${requestedQty} sản phẩm.`
        );
      }
    }

    if (existed) {
      // Cập nhật số lượng
      const updated = await CartItemModel.findByIdAndUpdate(
        existed._id,
        { $inc: { qty: requestedQty } },
        { new: true }
      ).lean();
      return updated;
    } else {
      // Tạo mới cart item
      const newItem = await CartItemModel.create({
        cart_id,
        product_id,
        qty: requestedQty,
      });
      return newItem.toObject();
    }
  },

  async updateItem(id, qty) {
    if (qty <= 0) {
      // Nếu số lượng <= 0 thì xóa item
      await CartItemModel.findByIdAndDelete(id);
      return null;
    }

    // Kiểm tra tồn kho trước khi cập nhật
    const cartItem = await CartItemModel.findById(id)
      .populate("product_id")
      .lean();
    if (!cartItem || !cartItem.product_id) {
      throw new Error("Mục giỏ hàng không tồn tại");
    }

    const product = cartItem.product_id;
    if (product.status !== "active") {
      throw new Error("Sản phẩm hiện không khả dụng");
    }

    const currentStock = product.stock_quantity ?? 0;
    if (qty > currentStock) {
      throw new Error(
        `Sản phẩm chỉ còn ${currentStock} sản phẩm trong kho. Không thể cập nhật số lượng thành ${qty}.`
      );
    }

    const updated = await CartItemModel.findByIdAndUpdate(
      id,
      { $set: { qty } },
      { new: true }
    ).lean();

    return updated;
  },

  async removeItem(id) {
    await CartItemModel.findByIdAndDelete(id);
    return true;
  },

  async clear(user_id) {
    const cart = await CartModel.findOne({ user_id }).lean();
    if (!cart) return true;

    await CartItemModel.deleteMany({ cart_id: cart._id });
    return true;
  },
};
