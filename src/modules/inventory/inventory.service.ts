import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { buildMeta, parsePagination } from '../../utils/pagination';
import { branchRepository } from '../branches/branches.repository';
import { inventoryRepository } from './inventory.repository';
import type {
  CreateInvCategoryDto,
  UpdateInvCategoryDto,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  AdjustStockDto,
  InventoryCategoryDto,
  InventoryItemDto,
  InventoryLogDto,
} from './inventory.dto';

function formatCategory(c: {
  id: number; branchId: number; name: string; sortOrder: number;
}): InventoryCategoryDto {
  return { id: c.id, branchId: c.branchId, name: c.name, sortOrder: c.sortOrder };
}

function formatItem(i: {
  id: number; branchId: number; categoryId: number | null;
  name: string; unit: string;
  quantity: number | { toNumber(): number };
  lowStockThreshold: number | { toNumber(): number };
}): InventoryItemDto {
  const qty   = typeof i.quantity === 'object' ? i.quantity.toNumber() : Number(i.quantity);
  const thresh = typeof i.lowStockThreshold === 'object'
    ? i.lowStockThreshold.toNumber() : Number(i.lowStockThreshold);
  return {
    id: i.id, branchId: i.branchId, categoryId: i.categoryId,
    name: i.name, unit: i.unit, quantity: qty,
    lowStockThreshold: thresh,
    isLowStock: thresh > 0 && qty <= thresh,
  };
}

function formatLog(l: {
  id: number; itemId: number; changedBy: number; changeType: string;
  quantityDelta: number | { toNumber(): number };
  note: string | null; createdAt: Date;
}): InventoryLogDto {
  return {
    id: l.id, itemId: l.itemId, changedBy: l.changedBy,
    changeType: l.changeType,
    quantityDelta: typeof l.quantityDelta === 'object'
      ? l.quantityDelta.toNumber() : Number(l.quantityDelta),
    note: l.note, createdAt: l.createdAt,
  };
}

async function assertBranch(branchId: number, restaurantId: number) {
  const b = await branchRepository.findById(branchId, restaurantId);
  if (!b) throw new AppError('Branch not found', 404, 'NOT_FOUND');
}

export const inventoryService = {
  // ─── Categories ──────────────────────────────────────────────────────────
  async listCategories(branchId: number, restaurantId: number): Promise<InventoryCategoryDto[]> {
    await assertBranch(branchId, restaurantId);
    const cats = await inventoryRepository.findAllCategories(branchId);
    return cats.map(formatCategory);
  },

  async createCategory(branchId: number, restaurantId: number, dto: CreateInvCategoryDto): Promise<InventoryCategoryDto> {
    await assertBranch(branchId, restaurantId);
    const cat = await inventoryRepository.createCategory({ branchId, ...dto });
    return formatCategory(cat);
  },

  async updateCategory(categoryId: number, branchId: number, restaurantId: number, dto: UpdateInvCategoryDto): Promise<InventoryCategoryDto> {
    await assertBranch(branchId, restaurantId);
    const existing = await inventoryRepository.findCategoryById(categoryId, branchId);
    if (!existing) throw new AppError('Category not found', 404, 'NOT_FOUND');
    const updated = await inventoryRepository.updateCategory(categoryId, dto);
    return formatCategory(updated);
  },

  async deleteCategory(categoryId: number, branchId: number, restaurantId: number): Promise<void> {
    await assertBranch(branchId, restaurantId);
    const existing = await inventoryRepository.findCategoryById(categoryId, branchId);
    if (!existing) throw new AppError('Category not found', 404, 'NOT_FOUND');
    await inventoryRepository.softDeleteCategory(categoryId);
  },

  // ─── Items ───────────────────────────────────────────────────────────────
  async listItems(branchId: number, restaurantId: number, lowStockOnly = false): Promise<InventoryItemDto[]> {
    await assertBranch(branchId, restaurantId);
    const items = await inventoryRepository.findAllItems(branchId, lowStockOnly);
    return items.map(formatItem);
  },

  async createItem(branchId: number, restaurantId: number, dto: CreateInventoryItemDto): Promise<InventoryItemDto> {
    await assertBranch(branchId, restaurantId);
    const item = await inventoryRepository.createItem({ branchId, ...dto });
    return formatItem(item);
  },

  async updateItem(itemId: number, branchId: number, restaurantId: number, dto: UpdateInventoryItemDto): Promise<InventoryItemDto> {
    await assertBranch(branchId, restaurantId);
    const existing = await inventoryRepository.findItemById(itemId, branchId);
    if (!existing) throw new AppError('Item not found', 404, 'NOT_FOUND');
    const updated = await inventoryRepository.updateItem(itemId, dto);
    return formatItem(updated);
  },

  /**
   * POST /branches/:branchId/inventory/:itemId/adjust — Staff+
   * §D15 / §H4: Manual-only stock adjustment. Writes inventory_logs row.
   * Atomic: quantity update + log insert in one transaction.
   * Guards: 'remove' changeType cannot reduce below zero.
   */
  async adjustStock(
    itemId: number,
    branchId: number,
    restaurantId: number,
    staffId: number,
    dto: AdjustStockDto,
  ): Promise<InventoryItemDto> {
    await assertBranch(branchId, restaurantId);

    return prisma.$transaction(async (tx) => {
      const item = await inventoryRepository.findItemById(itemId, branchId, tx);
      if (!item) throw new AppError('Item not found', 404, 'NOT_FOUND');

      const currentQty = typeof item.quantity === 'object'
        ? (item.quantity as any).toNumber() : Number(item.quantity);

      // Guard: cannot remove more than available
      if (dto.changeType === 'remove' && dto.quantityDelta < 0) {
        const absRemoval = Math.abs(dto.quantityDelta);
        if (absRemoval > currentQty) {
          throw new AppError(
            `Cannot remove ${absRemoval} ${item.unit} — only ${currentQty} available`,
            400,
            'INSUFFICIENT_STOCK',
          );
        }
      }

      // For 'adjust', the delta can be negative (full override) — we just apply it
      const updated = await inventoryRepository.adjustQuantity(itemId, dto.quantityDelta, tx);
      await inventoryRepository.createLog(
        {
          itemId,
          changedBy: staffId,
          changeType: dto.changeType,
          quantityDelta: dto.quantityDelta,
          note: dto.note ?? null,
        },
        tx,
      );

      return formatItem(updated);
    });
  },

  async deleteItem(itemId: number, branchId: number, restaurantId: number): Promise<void> {
    await assertBranch(branchId, restaurantId);
    const existing = await inventoryRepository.findItemById(itemId, branchId);
    if (!existing) throw new AppError('Item not found', 404, 'NOT_FOUND');
    await inventoryRepository.softDeleteItem(itemId);
  },

  async getLogs(
    itemId: number,
    branchId: number,
    restaurantId: number,
    query: Record<string, string | undefined>,
  ) {
    await assertBranch(branchId, restaurantId);
    const existing = await inventoryRepository.findItemById(itemId, branchId);
    if (!existing) throw new AppError('Item not found', 404, 'NOT_FOUND');
    const { skip, take } = parsePagination(query);
    const { rows, total } = await inventoryRepository.findLogs(itemId, { skip, take });
    return { data: rows.map(formatLog), meta: buildMeta(total, skip, take) };
  },
};
