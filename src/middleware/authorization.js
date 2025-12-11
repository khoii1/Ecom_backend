import { ROLES } from "../constants/roles.js";

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
    
    // Sử dụng MongoDB thay vì PostgreSQL
    const { StoreModel } = await import("../models/store.model.js");
    const store = await StoreModel.findOne({
      _id: storeId,
      owner_id: req.currentUser?.id,
    }).lean();
    
    if (store) return next();
    return res.status(403).json({ message: "Bạn không sở hữu cửa hàng này" });
  };
}

export function authorizeSelfOrAdmin(getUserId) {
  return (req, res, next) => {
    const targetUserId = getUserId(req);
    if (!req.currentUser)
      return res.status(401).json({ message: "Không có quyền truy cập" });
    if (req.currentUser.role === ROLES.ADMIN) return next();
    // MongoDB: ID là ObjectId string, so sánh trực tiếp
    if (req.currentUser.id === targetUserId?.toString()) return next();
    return res.status(403).json({ message: "Không được phép" });
  };
}
