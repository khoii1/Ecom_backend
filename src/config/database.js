import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 
  `mongodb://${process.env.MONGODB_HOST || 'localhost'}:${process.env.MONGODB_PORT || 27017}/${process.env.MONGODB_DATABASE || 'ecommerce'}`;

let isConnected = false;

export const connectDatabase = async () => {
  if (isConnected) {
    logger.info('DATABASE', 'MongoDB đã được kết nối');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    
    isConnected = true;
    logger.info('DATABASE', `Kết nối MongoDB thành công: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
    
    // Xử lý lỗi kết nối
    mongoose.connection.on('error', (err) => {
      logger.error('DATABASE', `Lỗi kết nối MongoDB: ${err.message}`);
      isConnected = false;
    });
    
    // Xử lý khi mất kết nối
    mongoose.connection.on('disconnected', () => {
      logger.warn('DATABASE', 'MongoDB đã ngắt kết nối');
      isConnected = false;
    });
    
    // Xử lý khi kết nối lại
    mongoose.connection.on('reconnected', () => {
      logger.info('DATABASE', 'MongoDB đã kết nối lại');
      isConnected = true;
    });
    
  } catch (error) {
    logger.error('DATABASE', `Lỗi khi kết nối MongoDB: ${error.message}`);
    isConnected = false;
    throw error;
  }
};

export const disconnectDatabase = async () => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('DATABASE', 'MongoDB đã ngắt kết nối');
  }
};

// Export mongoose connection để sử dụng trong models
export { mongoose };
