import { databasePool } from "../config/database.js";
import { OrderModel } from "../models/order.model.js";
import { OrderItemModel } from "../models/order_item.model.js";
import { ProductModel } from "../models/product.model.js";
import { ROLES } from "../constants/roles.js"; // <<< THÊM IMPORT NÀY NẾU CHƯA CÓ

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

    const cartId = cartItemsResult.rows[0].cart_id;

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
        unit_price: finalUnitPrice,
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
        status: "pending",
      });

      for (const itemData of orderItemsData) {
        await OrderItemModel.create({
          order_id: order.id,
          product_id: itemData.product_id,
          unit_price: itemData.unit_price,
          qty: itemData.qty,
        });
      }

      await client.query("COMMIT");
      console.log(`Order ${order.id} created successfully.`);

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

  async listMyOrders(user_id) {
    const query = `
      SELECT
        o.*,
        -- Lấy image_url của sản phẩm đầu tiên trong đơn hàng
        (SELECT p.image_url
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = o.id
         ORDER BY oi.id ASC -- Sắp xếp để đảm bảo lấy item đầu tiên
         LIMIT 1
        ) AS first_item_image_url
      FROM orders o
      WHERE o.buyer_id = $1
      ORDER BY o.created_at DESC
    `;
    try {
      const r = await databasePool.query(query, [user_id]);

      return r.rows.map((row) => ({
        ...row,
        id: row.id.toString(),
        buyer_id: row.buyer_id.toString(),
        store_id: row.store_id.toString(),
        first_item_image_url: row.first_item_image_url,
      }));
    } catch (dbError) {
      console.error(
        `Database error during listMyOrders for user ${user_id}:`,
        dbError
      );
      throw dbError;
    }
  },

  listByStore(store_id) {
    const numericStoreId = parseInt(store_id, 10);
    if (isNaN(numericStoreId)) throw new Error("ID cửa hàng không hợp lệ");
    // Sửa query để lấy thêm ảnh (tương tự listMyOrders)
    const query = `
      SELECT
        o.*,
        (SELECT p.image_url
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = o.id
         ORDER BY oi.id ASC
         LIMIT 1
        ) AS first_item_image_url,
        u.full_name as buyer_name -- Lấy thêm tên người mua
      FROM orders o
      JOIN users u ON o.buyer_id = u.id -- Join với bảng users
      WHERE o.store_id = $1
      ORDER BY o.created_at DESC
    `;

    return databasePool.query(query, [numericStoreId]).then((r) =>
      r.rows.map((row) => ({
        ...row,
        id: row.id.toString(),
        buyer_id: row.buyer_id.toString(),
        store_id: row.store_id.toString(),
        first_item_image_url: row.first_item_image_url, // Thêm trường ảnh
        buyer_name: row.buyer_name, // Thêm tên người mua
      }))
    );
  },
  async detail(order_id) {
    const numericOrderId = parseInt(order_id, 10);
    if (isNaN(numericOrderId)) return null;

    // Sửa query để lấy thêm order items và thông tin sản phẩm
    const orderQuery = "SELECT * FROM orders WHERE id=$1";
    const itemsQuery = `
        SELECT
            oi.*,
            p.title as product_title,
            p.image_url as product_image_url
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
        ORDER BY oi.id ASC
    `;

    try {
      const orderResult = await databasePool.query(orderQuery, [
        numericOrderId,
      ]);
      const order = orderResult.rows[0];
      if (!order) return null;

      const itemsResult = await databasePool.query(itemsQuery, [
        numericOrderId,
      ]);
      const items = itemsResult.rows.map((item) => ({
        ...item,
        id: item.id.toString(),
        order_id: item.order_id.toString(),
        product_id: item.product_id.toString(),
        // Có thể format thêm các trường khác nếu cần
      }));

      return {
        ...order,
        id: order.id.toString(),
        buyer_id: order.buyer_id.toString(),
        store_id: order.store_id.toString(),
        items: items, // Thêm danh sách items vào kết quả
      };
    } catch (dbError) {
      console.error(
        `Database error during detail for order ${order_id}:`,
        dbError
      );
      throw dbError;
    }
  },

  async updateStatus(order_id, status, currentUser) {
    const order = await this.detail(order_id);
    if (!order) return null;

    // Chỉ Admin hoặc chủ cửa hàng mới được cập nhật status
    let isAuthorized = false;
    if (currentUser.role === ROLES.ADMIN) {
      isAuthorized = true;
    } else if (currentUser.role === ROLES.SELLER) {
      const storeResponse = await databasePool.query(
        "SELECT owner_id FROM stores WHERE id=$1",
        [parseInt(order.store_id, 10)]
      );
      if (
        storeResponse.rows.length > 0 &&
        storeResponse.rows[0].owner_id === currentUser.id
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error("Bạn không có quyền cập nhật đơn hàng này");
    }

    // Kiểm tra xem trạng thái mới có hợp lệ không (tùy chọn)
    const validStatuses = [
      "pending",
      "paid",
      "payment_failed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      throw new Error(`Trạng thái "${status}" không hợp lệ.`);
    }

    // Cập nhật trạng thái
    const updatedOrder = await OrderModel.updateById(order.id, { status });
    if (!updatedOrder) return null;

    // Trả về thông tin đầy đủ sau khi cập nhật
    return {
      ...updatedOrder,
      id: updatedOrder.id.toString(),
      buyer_id: updatedOrder.buyer_id.toString(),
      store_id: updatedOrder.store_id.toString(),
      items: order.items,
    };
  },
};
