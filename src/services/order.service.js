import { databasePool } from "../config/database.js";
import { OrderModel } from "../models/order.model.js";
import { OrderItemModel } from "../models/order_item.model.js";

function genCode() {
  return "OD" + Date.now().toString(36).toUpperCase().slice(-8);
}

export const OrderService = {
  async createFromCart(user_id) {
    const r = await databasePool.query(
      "SELECT c.id AS cart_id, ci.product_id, ci.qty, p.store_id, p.price FROM carts c JOIN cart_items ci ON ci.cart_id=c.id JOIN products p ON p.id=ci.product_id WHERE c.user_id=$1",
      [user_id]
    );
    if (!r.rowCount) return { error: "Giỏ hàng trống" };
    const store_id = r.rows[0].store_id;
    const items = r.rows.filter((x) => x.store_id === store_id);
    let subtotal = 0;
    for (const it of items) subtotal += Number(it.price) * Number(it.qty);
    const total = subtotal;
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      const order = await OrderModel.create({
        code: genCode(),
        buyer_id: user_id,
        store_id,
        subtotal,
        total,
      });
      for (const it of items) {
        await OrderItemModel.create({
          order_id: order.id,
          product_id: it.product_id,
          unit_price: it.price,
          qty: it.qty,
        });
      }
      await client.query(
        "DELETE FROM cart_items WHERE cart_id=$1 AND product_id = ANY($2::uuid[])",
        [r.rows[0].cart_id, items.map((i) => i.product_id)]
      );
      await client.query("COMMIT");
      return order;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },
  listMyOrders(user_id) {
    return databasePool
      .query(
        "SELECT * FROM orders WHERE buyer_id=$1 ORDER BY created_at DESC",
        [user_id]
      )
      .then((r) => r.rows);
  },
  listByStore(store_id) {
    return databasePool
      .query(
        "SELECT * FROM orders WHERE store_id=$1 ORDER BY created_at DESC",
        [store_id]
      )
      .then((r) => r.rows);
  },
  detail(order_id) {
    return databasePool
      .query("SELECT * FROM orders WHERE id=$1", [order_id])
      .then((r) => r.rows[0] || null);
  },
  async updateStatus(order_id, status, currentUser) {
    // Check if user has permission to update this order
    const order = await this.detail(order_id);
    if (!order) return null;

    // Only admin or store owner can update order status
    if (currentUser.role !== "ADMIN") {
      const store = await databasePool.query(
        "SELECT owner_id FROM stores WHERE id=$1",
        [order.store_id]
      );
      if (!store.rows.length || store.rows[0].owner_id !== currentUser.id) {
        throw new Error("FORBIDDEN");
      }
    }

    return OrderModel.updateById(order_id, { status });
  },
};
