import { ROLES } from "../constants/roles.js";
import { databasePool } from "../config/database.js";

export function authorizeByRoles(allowed = []) {
  return (req, res, next) => {
    if (!req.currentUser)
      return res.status(401).json({ message: "Không có quyền truy cập" });
    if (!allowed.length) return next();
    if (allowed.includes(req.currentUser.role)) return next();
    return res.status(403).json({ message: "Không được phép" });
  };
}

export function authorizeStoreOwnership(paramName = "storeId") {
  return async (req, res, next) => {
    const storeId = req.params[paramName] || req.body.store_id;
    if (!storeId) return res.status(400).json({ message: "Thiếu mã cửa hàng" });
    if (req.currentUser?.role === ROLES.ADMIN) return next();
    const r = await databasePool.query(
      "SELECT 1 FROM stores WHERE id=$1 AND owner_id=$2",
      [storeId, req.currentUser?.id]
    );
    if (r.rowCount) return next();
    return res.status(403).json({ message: "Bạn không sở hữu cửa hàng này" });
  };
}

export function authorizeSelfOrAdmin(getUserId) {
  return (req, res, next) => {
    const targetUserId = getUserId(req);
    if (!req.currentUser)
      return res.status(401).json({ message: "Không có quyền truy cập" });
    if (req.currentUser.role === ROLES.ADMIN) return next();
    if (req.currentUser.id === parseInt(targetUserId)) return next(); // Parse target ID to integer for comparison
    return res.status(403).json({ message: "Không được phép" });
  };
}
