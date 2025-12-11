import { logger } from "../utils/logger.js";

/**
 * Middleware ghi log cho mọi HTTP request
 * Ghi lại thông tin request khi đến và response khi trả về
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Bỏ qua static files (nhưng vẫn log health check)
  if (req.path.startsWith('/admin/') && !req.path.endsWith('.html')) {
    return next();
  }
  
  // Log request đến (log tất cả API calls)
  if (req.path.startsWith('/auth/') || req.path.startsWith('/api/') || 
      !req.path.startsWith('/admin/')) {
    logger.info('API', `${req.method} ${req.originalUrl || req.url}`);
  }

  // Lưu lại hàm res.json gốc để intercept response
  const originalJson = res.json.bind(res);
  let responseLogged = false;
  
  res.json = function(data) {
    const duration = Date.now() - startTime;
    responseLogged = true;
    
    // Log response với status code
    if (res.statusCode >= 500) {
      logger.error('API', `${req.method} ${req.originalUrl || req.url} → ${res.statusCode} ERROR (${duration}ms)`);
    } else if (res.statusCode >= 400) {
      logger.warn('API', `${req.method} ${req.originalUrl || req.url} → ${res.statusCode} FAILED (${duration}ms)`);
    } else {
      logger.info('API', `${req.method} ${req.originalUrl || req.url} → ${res.statusCode} OK (${duration}ms)`);
    }

    return originalJson(data);
  };

  // Xử lý khi response được gửi (bao gồm cả lỗi)
  res.on('finish', () => {
    if (!responseLogged) {
      const duration = Date.now() - startTime;
      const contentType = res.get('Content-Type') || '';
      
      if (res.statusCode >= 500) {
        logger.error('API', `${req.method} ${req.originalUrl || req.url} → ${res.statusCode} ERROR (${duration}ms)`);
      } else if (res.statusCode >= 400) {
        logger.warn('API', `${req.method} ${req.originalUrl || req.url} → ${res.statusCode} FAILED (${duration}ms)`);
      } else {
        logger.info('API', `${req.method} ${req.originalUrl || req.url} → ${res.statusCode} OK (${duration}ms)`);
      }
    }
  });
  
  // Log lỗi nếu có
  res.on('error', (err) => {
    logger.error('API', `${req.method} ${req.originalUrl || req.url} → Response Error: ${err.message}`);
  });

  next();
}

export default requestLogger;

