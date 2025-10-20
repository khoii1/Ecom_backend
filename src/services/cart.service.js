import { databasePool } from '../config/database.js';
import { CartModel } from '../models/cart.model.js';
import { CartItemModel } from '../models/cart_item.model.js';

export const CartService = {
  async ensure(user_id) {
    const existed = await CartModel.findByUserId(user_id);
    if (existed) return existed.id;
    const c = await CartModel.create({ user_id });
    return c.id;
  },
  async getMyCart(user_id) {
    const cart_id = await this.ensure(user_id);
    const items = await databasePool.query(
      'SELECT ci.id, ci.product_id, ci.qty, p.title, p.price FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.cart_id=$1',
      [cart_id]
    );
    return { cart_id, items: items.rows };
  },
  async addItem(user_id, { product_id, qty }) {
    const cart_id = await this.ensure(user_id);
    const existed = await CartItemModel.findByCartAndProduct(cart_id, product_id);
    if (existed) return CartItemModel.updateById(existed.id, { qty: existed.qty + Number(qty) });
    return CartItemModel.create({ cart_id, product_id, qty });
  },
  updateItem(id, qty) { return CartItemModel.updateById(id, { qty }); },
  removeItem(id) { return CartItemModel.deleteById(id); },
  async clear(user_id) {
    const cart = await CartModel.findByUserId(user_id);
    if (!cart) return true;
    await databasePool.query('DELETE FROM cart_items WHERE cart_id=$1', [cart.id]);
    return true;
  },
};
