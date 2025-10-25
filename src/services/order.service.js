import { databasePool } from "../config/database.js";
import { OrderModel } from "../models/order.model.js";
import { OrderItemModel } from "../models/order_item.model.js";
import { ProductModel } from "../models/product.model.js";

function genCode() {
  return "OD" + Date.now().toString(36).toUpperCase().slice(-8);
}

export const OrderService = {
  async createFromCart(user_id) {
    // 1. Lấy thông tin cart items và product details (bao gồm cả discount)
    const cartItemsResult = await databasePool.query(
      `SELECT
         c.id AS cart_id,
         ci.product_id,
         ci.qty,
         p.store_id,
         p.price AS original_price,
         p.discount_percentage,
         p.title
       FROM carts c
       JOIN cart_items ci ON ci.cart_id = c.id
       JOIN products p ON p.id = ci.product_id
       WHERE c.user_id = $1`,
      [user_id]
    );

    if (!cartItemsResult.rowCount) {
      throw new Error("Giỏ hàng trống");
    }

    const cartId = cartItemsResult.rows[0].cart_id; // Lấy cart_id để xóa sau

    // TODO: Xử lý trường hợp giỏ hàng có sản phẩm từ nhiều cửa hàng khác nhau
    // Tạm thời chỉ lấy store_id của item đầu tiên
    const store_id = cartItemsResult.rows[0].store_id;
    const itemsForThisOrder = cartItemsResult.rows.filter(
      (x) => x.store_id === store_id
    );

    if (!itemsForThisOrder.length) {
      throw new Error("Không có sản phẩm nào hợp lệ để tạo đơn hàng.");
    }

    // 2. Tính toán lại subtotal và total dựa trên giá *sau giảm giá*
    let calculatedSubtotal = 0;
    const orderItemsData = itemsForThisOrder.map((item) => {
      const price = parseFloat(item.original_price);
      const discount = parseFloat(item.discount_percentage || 0);
      // Tính giá cuối cùng của sản phẩm tại thời điểm tạo đơn hàng
      const finalUnitPrice = ProductModel.calculateFinalPrice(price, discount);
      calculatedSubtotal += finalUnitPrice * parseInt(item.qty, 10);
      return {
        product_id: item.product_id,
        unit_price: finalUnitPrice, // Lưu giá đã giảm vào order_items
        qty: parseInt(item.qty, 10),
      };
    });
    const calculatedTotal = calculatedSubtotal;

    // 3. Tạo Order và OrderItems trong transaction
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");

      // Tạo bản ghi Order với trạng thái 'pending'
      const order = await OrderModel.create({
        code: genCode(),
        buyer_id: user_id,
        store_id,
        subtotal: calculatedSubtotal,
        total: calculatedTotal,
        status: "pending", // Trạng thái ban đầu chờ thanh toán
      });

      // Tạo các bản ghi OrderItems tương ứng
      for (const itemData of orderItemsData) {
        await OrderItemModel.create({
          order_id: order.id, // ID của order vừa tạo
          product_id: itemData.product_id,
          unit_price: itemData.unit_price, // Lưu giá đã giảm
          qty: itemData.qty,
        });
      }

      // --- SỬA: KHÔNG XÓA cart_items Ở ĐÂY ---
      // Xóa cart items chỉ nên xảy ra SAU KHI thanh toán thành công (trong webhook handler)
      // Dòng DELETE CART ITEMS CŨ BỊ VÔ HIỆU HÓA HOẶC XÓA Ở ĐÂY

      // --- SỬA: Thêm Order ID vào metadata của Cart (tùy chọn) để dễ dàng đối chiếu
      // await client.query("UPDATE carts SET last_order_id=$1 WHERE id=$2", [order.id, cartId]);

      await client.query("COMMIT");
      console.log(`Order ${order.id} created successfully.`);
      // Trả về order object đầy đủ (bao gồm ID)
      // Format ID thành string trước khi trả về
      return {
        ...order,
        id: order.id.toString(),
        buyer_id: order.buyer_id.toString(),
        store_id: order.store_id.toString(),
      };
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("Error creating order from cart:", e);
      throw new Error(`Không thể tạo đơn hàng: ${e.message}`);
    } finally {
      client.release();
    }
  },

  // ... (các hàm khác) ...
  listMyOrders(user_id) {
    return databasePool
      .query(
        "SELECT * FROM orders WHERE buyer_id=$1 ORDER BY created_at DESC",
        [user_id]
      )
      .then((r) =>
        r.rows.map((row) => ({
          ...row,
          id: row.id.toString(),
          buyer_id: row.buyer_id.toString(),
          store_id: row.store_id.toString(),
        }))
      );
  },
  listByStore(store_id) {
    const numericStoreId = parseInt(store_id, 10);
    if (isNaN(numericStoreId)) throw new Error("ID cửa hàng không hợp lệ");
    return databasePool
      .query(
        "SELECT * FROM orders WHERE store_id=$1 ORDER BY created_at DESC",
        [numericStoreId]
      )
      .then((r) =>
        r.rows.map((row) => ({
          ...row,
          id: row.id.toString(),
          buyer_id: row.buyer_id.toString(),
          store_id: row.store_id.toString(),
        }))
      );
  },
  async detail(order_id) {
    const numericOrderId = parseInt(order_id, 10);
    if (isNaN(numericOrderId)) return null;

    const r = await databasePool.query("SELECT * FROM orders WHERE id=$1", [
      numericOrderId,
    ]);
    const order = r.rows[0];
    if (!order) return null;
    return {
      ...order,
      id: order.id.toString(),
      buyer_id: order.buyer_id.toString(),
      store_id: order.store_id.toString(),
    };
  },

  async updateStatus(order_id, status, currentUser) {
    // ... (giữ nguyên logic updateStatus) ...
    const order = await this.detail(order_id);
    if (!order) return null;

    if (currentUser.role !== ROLES.ADMIN) {
      const store = await databasePool.query(
        "SELECT owner_id FROM stores WHERE id=$1",
        [parseInt(order.store_id, 10)]
      );
      if (!store.rows.length || store.rows[0].owner_id !== currentUser.id) {
        throw new Error("Bạn không có quyền cập nhật đơn hàng này");
      }
    }

    const updatedOrder = await OrderModel.updateById(order_id, { status });
    if (!updatedOrder) return null;
    return {
      ...updatedOrder,
      id: updatedOrder.id.toString(),
      buyer_id: updatedOrder.buyer_id.toString(),
      store_id: updatedOrder.store_id.toString(),
    };
  },
};
