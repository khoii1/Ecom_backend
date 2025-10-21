import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cấu hình storage với Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "ecom-products", // Thư mục trên Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [
      { width: 800, height: 800, crop: "limit" }, // Resize ảnh tự động
      { quality: "auto" }, // Tối ưu chất lượng
    ],
  },
});

// Kiểm tra file type
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(
      new Error("Chỉ cho phép upload file hình ảnh (jpg, png, gif, webp)"),
      false
    );
  }
};

// Cấu hình multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Giới hạn file 10MB
  },
});

// Middleware xử lý single file upload
export const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "File quá lớn. Kích thước tối đa là 10MB",
          });
        }
        return res.status(400).json({
          message: "Lỗi upload file: " + err.message,
        });
      } else if (err) {
        return res.status(400).json({
          message: err.message,
        });
      }
      next();
    });
  };
};

// Middleware xử lý multiple files upload
export const uploadMultiple = (fieldName, maxCount = 10) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "File quá lớn. Kích thước tối đa là 10MB",
          });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            message: `Số lượng file vượt quá giới hạn ${maxCount}`,
          });
        }
        return res.status(400).json({
          message: "Lỗi upload file: " + err.message,
        });
      } else if (err) {
        return res.status(400).json({
          message: err.message,
        });
      }
      next();
    });
  };
};

// Helper function để delete file từ Cloudinary
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    throw error;
  }
};
