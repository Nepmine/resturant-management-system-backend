import { Router } from 'express';
import { customerMenuController } from './menu.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { memberAuth } from '../../middleware/memberAuth';
import { customerMenuItemParamSchema } from './menu.schema';

// Mounted under /customer/menu in app.ts
const router = Router();

// GET /customer/menu — Member JWT
// Full menu: categories → items → option groups → options
router.get(
  '/',
  memberAuth,
  asyncHandler(customerMenuController.getFullMenu),
);

// GET /customer/menu/categories — Member JWT
// Categories only (lightweight for tab navigation)
// Must be declared BEFORE /:itemId param route
router.get(
  '/categories',
  memberAuth,
  asyncHandler(customerMenuController.getCategories),
);

// GET /customer/menu/items/:itemId — Member JWT
router.get(
  '/items/:itemId',
  memberAuth,
  validate({ params: customerMenuItemParamSchema.shape.params }),
  asyncHandler(customerMenuController.getItemById),
);

export default router;
