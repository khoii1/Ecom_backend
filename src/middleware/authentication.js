import jwt from "jsonwebtoken";

export function authentication(required = true) {
  return (req, res, next) => {
    const headerValue = req.headers.authorization || "";
    const token = headerValue.startsWith("Bearer ")
      ? headerValue.slice(7)
      : null;
    if (!token && required)
      return res.status(401).json({ message: "Không có quyền truy cập" });
    if (!token) return next();
    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      req.currentUser = { id: parseInt(payload.sub), role: payload.role }; // Parse string ID back to integer
      next();
    } catch {
      if (required)
        return res.status(401).json({ message: "Token không hợp lệ" });
      next();
    }
  };
}
