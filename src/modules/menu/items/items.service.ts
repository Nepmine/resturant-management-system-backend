import prisma from '../../../config/database';
import { AppError } from '../../../middleware/errorHandler';
import { auditLog } from '../../../utils/auditLog';
import { categoryRepository } from '../categories/categories.repository';
import { itemRepository } from './items.repository';
import type {
  CreateItemDto,
  UpdateItemDto,
  AvailabilityDto,
  MenuItemDto,
  OptionGroupDto,
  OptionDto,
} from './items.dto';

// ─── formatters ────────────────────────────────────────────────────────────

function formatOption(o: {
  id: number;
  groupId: number;
  name: string;
  priceModifier: number | { toNumber(): number };
  sortOrder: number;
}): OptionDto {
  return {
    id: o.id,
    groupId: o.groupId,
    name: o.name,
    priceModifier: typeof o.priceModifier === 'object' ? o.priceModifier.toNumber() : Number(o.priceModifier),
    sortOrder: o.sortOrder,
  };
}

function formatGroup(g: {
  id: number;
  menuItemId: number;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: Array<{
    id: number;
    groupId: number;
    name: string;
    priceModifier: number | { toNumber(): number };
    sortOrder: number;
  }>;
}): OptionGroupDto {
  return {
    id: g.id,
    menuItemId: g.menuItemId,
    name: g.name,
    isRequired: g.isRequired,
    sortOrder: g.sortOrder,
    options: g.options.map(formatOption),
  };
}

function formatItem(
  i: {
    id: number;
    categoryId: number;
    name: string;
    description: string | null;
    basePrice: number | { toNumber(): number };
    imageUrl: string | null;
    isAvailable: boolean;
    disableNote: string | null;
    sortOrder: number;
    createdAt: Date;
    optionGroups?: Array<{
      id: number;
      menuItemId: number;
      name: string;
      isRequired: boolean;
      sortOrder: number;
      options: Array<{
        id: number;
        groupId: number;
        name: string;
        priceModifier: number | { toNumber(): number };
        sortOrder: number;
      }>;
    }>;
  },
  withVariants = false,
): MenuItemDto {
  return {
    id: i.id,
    categoryId: i.categoryId,
    name: i.name,
    description: i.description,
    basePrice: typeof i.basePrice === 'object' ? i.basePrice.toNumber() : Number(i.basePrice),
    imageUrl: i.imageUrl,
    isAvailable: i.isAvailable,
    disableNote: i.disableNote,
    sortOrder: i.sortOrder,
    createdAt: i.createdAt,
    ...(withVariants && i.optionGroups !== undefined && {
      optionGroups: i.optionGroups.map(formatGroup),
    }),
  };
}

// ─── guards ────────────────────────────────────────────────────────────────

async function assertCategoryInBranch(categoryId: number, branchId: number) {
  const cat = await categoryRepository.findById(categoryId, branchId);
  if (!cat) throw new AppError('Category not found', 404, 'NOT_FOUND');
  return cat;
}

async function assertItemInBranch(itemId: number, branchId: number) {
  const item = await itemRepository.findByIdAndBranch(itemId, branchId);
  if (!item) throw new AppError('Menu item not found', 404, 'NOT_FOUND');
  return item;
}

// ─── service ───────────────────────────────────────────────────────────────

export const itemService = {
  /**
   * POST /menu/categories/:categoryId/items — Manager+
   */
  async create(
    categoryId: number,
    branchId: number,
    staffId: number,
    dto: CreateItemDto,
  ): Promise<MenuItemDto> {
    await assertCategoryInBranch(categoryId, branchId);

    return prisma.$transaction(async (tx) => {
      const item = await itemRepository.create({ categoryId, ...dto }, tx);

      await auditLog(tx, {
        staffId,
        branchId,
        action: 'menu_item.created',
        actionType: 'menu_item.created',
        targetType: 'menu_item',
        targetId: item.id,
        meta: { name: item.name, basePrice: item.basePrice },
      });

      return formatItem(item, true);
    });
  },

  /**
   * GET /menu/items/:itemId — Staff+
   * Returns full item with all option groups + options.
   */
  async getById(itemId: number, branchId: number): Promise<MenuItemDto> {
    const item = await assertItemInBranch(itemId, branchId);
    return formatItem(item, true);
  },

  /**
   * PATCH /menu/items/:itemId — Manager+
   * §D7: Writes audit log with old/new values on every update.
   */
  async update(
    itemId: number,
    branchId: number,
    staffId: number,
    dto: UpdateItemDto,
  ): Promise<MenuItemDto> {
    const existing = await assertItemInBranch(itemId, branchId);

    return prisma.$transaction(async (tx) => {
      const updated = await itemRepository.update(itemId, dto, tx);

      // Build old/new diff for audit trail
      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};
      for (const key of Object.keys(dto) as Array<keyof UpdateItemDto>) {
        const oldVal = (existing as Record<string, unknown>)[key];
        const newVal = dto[key];
        if (newVal !== undefined && oldVal !== newVal) {
          oldValues[key] = oldVal;
          newValues[key] = newVal;
        }
      }

      await auditLog(tx, {
        staffId,
        branchId,
        action: 'menu_item.updated',
        actionType: 'menu_item.updated',
        targetType: 'menu_item',
        targetId: itemId,
        meta: { old: oldValues, new: newValues },
      });

      return formatItem(updated, true);
    });
  },

  /**
   * PATCH /menu/items/:itemId/availability — Staff+
   * Toggles is_available and sets optional disable_note.
   */
  async setAvailability(
    itemId: number,
    branchId: number,
    staffId: number,
    dto: AvailabilityDto,
  ): Promise<MenuItemDto> {
    const existing = await assertItemInBranch(itemId, branchId);

    return prisma.$transaction(async (tx) => {
      const updated = await itemRepository.updateAvailability(
        itemId,
        {
          isAvailable: dto.isAvailable,
          disableNote: dto.isAvailable ? null : (dto.disableNote ?? null),
        },
        tx,
      );

      await auditLog(tx, {
        staffId,
        branchId,
        action: dto.isAvailable ? 'menu_item.enabled' : 'menu_item.disabled',
        actionType: dto.isAvailable ? 'menu_item.enabled' : 'menu_item.disabled',
        targetType: 'menu_item',
        targetId: itemId,
        meta: {
          wasAvailable: existing.isAvailable,
          disableNote: dto.disableNote ?? null,
        },
      });

      return formatItem(updated);
    });
  },

  /**
   * DELETE /menu/items/:itemId — Manager+
   */
  async softDelete(
    itemId: number,
    branchId: number,
    staffId: number,
  ): Promise<void> {
    const existing = await assertItemInBranch(itemId, branchId);

    return prisma.$transaction(async (tx) => {
      await itemRepository.softDelete(itemId, tx);

      await auditLog(tx, {
        staffId,
        branchId,
        action: 'menu_item.deleted',
        actionType: 'menu_item.deleted',
        targetType: 'menu_item',
        targetId: itemId,
        meta: { name: existing.name },
      });
    });
  },
};
