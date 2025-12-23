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
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "avif"],
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
      new Error(
        "Chỉ cho phép upload file hình ảnh (jpg, png, gif, webp, avif)"
      ),
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

// Storage cho review images
const reviewStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "ecom-reviews", // Thư mục riêng cho review images
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "avif"],
    transformation: [
      { width: 800, height: 800, crop: "limit" },
      { quality: "auto" },
    ],
  },
});

const reviewUpload = multer({
  storage: reviewStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5, // Tối đa 5 files
  },
});

// Middleware validate review images
export const validateReviewImages = (req, res, next) => {
  // Kiểm tra có file không
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      message: "Vui lòng chọn ít nhất 1 ảnh để upload",
    });
  }

  // Kiểm tra số lượng file
  if (req.files.length > 5) {
    return res.status(400).json({
      message: "Chỉ được upload tối đa 5 ảnh",
    });
  }

  // Kiểm tra từng file
  for (const file of req.files) {
    // Kiểm tra kích thước
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        message: `File ${file.originalname} quá lớn. Kích thước tối đa là 10MB`,
      });
    }

    // Kiểm tra định dạng
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/avif",
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        message: `File ${file.originalname} không đúng định dạng. Chỉ hỗ trợ JPG, PNG, WEBP, AVIF`,
      });
    }

    // Kiểm tra URL từ Cloudinary
    if (!file.path || !file.path.startsWith("http")) {
      return res.status(500).json({
        message: `Lỗi upload file ${file.originalname} lên Cloudinary`,
      });
    }
  }

  next();
};

// Storage cho delivery proof images
const deliveryProofStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "ecom-delivery-proof", // Thư mục riêng cho delivery proof images
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "avif"],
    transformation: [
      { width: 800, height: 800, crop: "limit" },
      { quality: "auto" },
    ],
  },
});

const deliveryProofUpload = multer({
  storage: deliveryProofStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Middleware xử lý multiple files upload
export const uploadMultiple = (
  fieldName,
  maxCount = 10,
  useReviewFolder = false
) => {
  const uploadInstance = useReviewFolder ? reviewUpload : upload;
  return (req, res, next) => {
    uploadInstance.array(fieldName, maxCount)(req, res, (err) => {
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

// Storage cho banner images - Giữ nguyên tỷ lệ gốc, chỉ tối ưu chất lượng
const bannerStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "ecom-banners", // Thư mục riêng cho banners
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "avif"],
    transformation: [
      { quality: "auto" }, // Chỉ tối ưu chất lượng, không resize/crop để giữ nguyên tỷ lệ gốc
    ],
  },
});

const bannerUpload = multer({
  storage: bannerStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Middleware upload banner image
export const uploadBanner = (fieldName = "image") => {
  return (req, res, next) => {
    bannerUpload.single(fieldName)(req, res, (err) => {
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

// Middleware upload delivery proof image
export const uploadDeliveryProof = (fieldName = "delivery_proof_image") => {
  return (req, res, next) => {
    deliveryProofUpload.single(fieldName)(req, res, (err) => {
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
