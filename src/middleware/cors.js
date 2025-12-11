import { logger } from "../utils/logger.js";

export function corsMiddleware(req, res, next) {
  // Allow requests from common development origins
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://localhost:5000", // Flutter web default
    "http://localhost:5001",
    // Ngrok và các tunnel services
    ...(process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : []),
  ];

  const origin = req.headers.origin;

  // Cho phép tất cả origins trong development (hoặc ngrok)
  if (process.env.NODE_ENV !== 'production') {
    // Cho phép ngrok và localhost
    if (origin && (origin.includes('ngrok') || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (origin) {
      // Trong dev mode, log nhưng vẫn cho phép
      logger.warn('CORS', `Origin không trong whitelist: ${origin} | Path: ${req.path}`);
      res.setHeader("Access-Control-Allow-Origin", origin); // Cho phép trong dev
    }
  } else {
    // Production: chỉ cho phép origins trong whitelist
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      // Production: không cho phép origin không trong whitelist
      logger.warn('CORS', `Production: Origin bị từ chối: ${origin} | Path: ${req.path}`);
      // Không set Access-Control-Allow-Origin để browser từ chối request
    }
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  next();
}
