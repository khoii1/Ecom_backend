import express from 'express';
import { BannerController } from '../controllers/banner.controller.js';
import { authentication } from '../middleware/authentication.js';
import { authorizeByRoles } from '../middleware/authorization.js';
import { uploadBanner } from '../middleware/upload.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

// Public routes
router.get('/', BannerController.list);
router.get('/stats', authentication(), authorizeByRoles([ROLES.ADMIN]), BannerController.stats);
router.get('/:bannerId', BannerController.detail);
router.post('/:bannerId/click', BannerController.click); // Public để track clicks

// Admin only routes
// Upload banner image endpoint
router.post(
  '/upload-image',
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  uploadBanner('image'),
  BannerController.uploadImage
);

router.post(
  '/',
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  BannerController.create
);
router.put(
  '/:bannerId',
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  BannerController.update
);
router.delete(
  '/:bannerId',
  authentication(),
  authorizeByRoles([ROLES.ADMIN]),
  BannerController.remove
);

export default router;

