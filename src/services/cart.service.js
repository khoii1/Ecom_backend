import { databasePool } from "../config/database.js";
import { CartModel } from "../models/cart.model.js";
import { CartItemModel } from "../models/cart_item.model.js";

export const CartService = {
  async ensure(user_id) {
    const existed = await CartModel.findByUserId(user_id);
    if (existed) return existed.id;
    const c = await CartModel.create({ user_id });
    return c.id;
  },
  async getMyCart(user_id) {
    const cart_id = await this.ensure(user_id);
    // SỬA: Cập nhật câu query để lấy thêm image_url và discount_percentage
    const itemsResult = await databasePool.query(
      `SELECT
         ci.id,                -- ID của cart_item
         ci.product_id,        -- ID của product
         ci.qty,               -- Số lượng
         p.title,              -- Tên sản phẩm
         p.price,              -- Giá gốc
         p.discount_percentage,-- % giảm giá
         p.image_url           -- URL ảnh
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = $1
       ORDER BY p.title`, // Sắp xếp theo tên cho dễ nhìn (tùy chọn)
      [cart_id]
    );

    // Tính toán final_price và subtotal ở backend luôn cho tiện
    let subtotal = 0;
    const items = itemsResult.rows.map((item) => {
      const price = parseFloat(item.price);
      const discount = parseFloat(item.discount_percentage || 0);
      const finalPrice =
        discount > 0 ? price - (price * discount) / 100 : price;
      subtotal += finalPrice * item.qty;
      return {
        ...item,
        // Chuyển đổi kiểu dữ liệu nếu cần và thêm finalPrice
        id: item.id.toString(),
        product_id: item.product_id.toString(),
        price: price, // Giữ dạng số
        discount_percentage: discount, // Giữ dạng số
        final_price: finalPrice, // Giá đã tính toán
        qty: parseInt(item.qty, 10), // Đảm bảo là số nguyên
      };
    });

    return {
      cart_id: cart_id.toString(), // Đảm bảo ID là string
      items: items,
      subtotal: subtotal, // Trả về subtotal đã tính
    };
    // --- KẾT THÚC SỬA ---
  },
  async addItem(user_id, { product_id, qty }) {
    const cart_id = await this.ensure(user_id);
    const existed = await CartItemModel.findByCartAndProduct(
      cart_id,
      product_id
    );
    if (existed) {
      // Cập nhật số lượng
      return CartItemModel.updateById(existed.id, {
        qty: existed.qty + Number(qty),
      });
    } else {
      // Tạo mới cart item
      return CartItemModel.create({ cart_id, product_id, qty });
      // Lưu ý: Response này chỉ có id, cart_id, product_id, qty.
      // CartProvider sẽ gọi fetchCart để lấy đủ thông tin sau.
    }
  },
  // SỬA: updateItem giờ chỉ cần gọi model, không cần trả về gì phức tạp
  updateItem(id, qty) {
    if (qty <= 0) {
      // Nếu số lượng <= 0 thì xóa item
      return CartItemModel.deleteById(id);
    }
    return CartItemModel.updateById(id, { qty });
    // CartProvider sẽ gọi fetchCart để lấy đủ thông tin sau.
  },
  // --- KẾT THÚC SỬA ---
  removeItem(id) {
    return CartItemModel.deleteById(id);
  },
  async clear(user_id) {
    const cart = await CartModel.findByUserId(user_id);
    if (!cart) return true;
    // SỬA: Truy vấn xóa cart items phải dùng id từ cart lấy được
    await databasePool.query("DELETE FROM cart_items WHERE cart_id=$1", [
      cart.id,
    ]);
    // --- KẾT THÚC SỬA ---
    return true;
  },
};
