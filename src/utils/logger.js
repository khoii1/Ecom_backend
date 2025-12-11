/**
 * Logger Utility - Ghi log cho các hoạt động trong hệ thống
 * Hỗ trợ các cấp độ: info, warn, error, debug
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  
  // Text colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  
  // Background colors
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

const currentLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO 
  : LOG_LEVELS.DEBUG;

/**
 * Format timestamp cho log
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Format message đơn giản - không có timestamp và emoji
 */
function formatMessage(level, context, message, data = null) {
  let color, levelStr;
  
  switch (level) {
    case 'DEBUG':
      color = COLORS.dim + COLORS.white;
      levelStr = 'DEBUG';
      break;
    case 'INFO':
      color = COLORS.green;
      levelStr = 'INFO';
      break;
    case 'WARN':
      color = COLORS.yellow;
      levelStr = 'WARN';
      break;
    case 'ERROR':
      color = COLORS.red;
      levelStr = 'ERROR';
      break;
    default:
      color = COLORS.white;
      levelStr = 'LOG';
  }
  
  const contextStr = context ? `[${context}]` : '';
  let output = `${color}${levelStr}${COLORS.reset} ${contextStr} ${message}`;
  
  if (data !== null && data !== undefined && typeof data === 'object') {
    const sanitizedData = sanitizeData(data);
    const dataStr = JSON.stringify(sanitizedData);
    if (dataStr.length < 200) {
      output += ` | ${dataStr}`;
    }
  }
  
  return output;
}

/**
 * Ẩn các thông tin nhạy cảm trong log
 */
function sanitizeData(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveFields = ['password', 'password_hash', 'token', 'access_token', 'token_hash', 'code', 'newPassword'];
  const sanitized = { ...data };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***HIDDEN***';
    }
  }
  
  return sanitized;
}

/**
 * Logger object với các phương thức log
 */
export const logger = {
  /**
   * Log debug - dùng cho thông tin chi tiết khi phát triển
   */
  debug(context, message, data = null) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.log(formatMessage('DEBUG', context, message, data));
    }
  },

  /**
   * Log info - dùng cho các hoạt động thành công
   */
  info(context, message, data = null) {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.log(formatMessage('INFO', context, message, data));
    }
  },

  /**
   * Log warning - dùng cho các cảnh báo
   */
  warn(context, message, data = null) {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(formatMessage('WARN', context, message, data));
    }
  },

  /**
   * Log error - dùng cho các lỗi
   */
  error(context, message, data = null) {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error(formatMessage('ERROR', context, message, data));
    }
  },

  /**
   * Log request - dùng để log HTTP requests
   */
  request(req, message = null) {
    const info = {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.connection?.remoteAddress,
      userId: req.currentUser?.id || 'anonymous',
    };
    
    const msg = message || `${req.method} ${req.originalUrl || req.url}`;
    this.info('HTTP', msg, info);
  },

  /**
   * Log response - dùng để log HTTP responses
   */
  response(req, statusCode, message = null) {
    const info = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      userId: req.currentUser?.id || 'anonymous',
    };
    
    const msg = message || `Response ${statusCode}`;
    
    if (statusCode >= 500) {
      this.error('HTTP', msg, info);
    } else if (statusCode >= 400) {
      this.warn('HTTP', msg, info);
    } else {
      this.info('HTTP', msg, info);
    }
  },

  /**
   * Log auth action - dùng riêng cho authentication
   */
  auth(action, email, success, details = null) {
    const data = { email, success, ...details };
    if (success) {
      this.info('AUTH', `${action} thành công`, data);
    } else {
      this.warn('AUTH', `${action} thất bại`, data);
    }
  },

  /**
   * Log database query - dùng cho các truy vấn database
   */
  db(operation, table, details = null) {
    this.debug('DATABASE', `${operation} on ${table}`, details);
  },
};

export default logger;

