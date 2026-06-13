import { AppError } from '../../middleware/errorHandler';
import { customerMenuRepository } from './menu.repository';
import type {
  CustomerMenuDto,
  CustomerMenuCategoryDto,
  CustomerMenuItemDto,
  CustomerOptionGroupDto,
  CustomerOptionDto,
} from './menu.dto';
import type { MemberTokenPayload } from '../../types/express';

// ─── formatters ────────────────────────────────────────────────────────────

function formatOption(o: {
  id: number;
  name: string;
  priceModifier: number | { toNumber(): number };
  sortOrder: number;
}): CustomerOptionDto {
  return {
    id: o.id,
    name: o.name,
    priceModifier: typeof o.priceModifier === 'object'
      ? o.priceModifier.toNumber()
      : Number(o.priceModifier),
    sortOrder: o.sortOrder,
  };
}

function formatGroup(g: {
  id: number;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: Array<{
    id: number;
    name: string;
    priceModifier: number | { toNumber(): number };
    sortOrder: number;
  }>;
}): CustomerOptionGroupDto {
  return {
    id: g.id,
    name: g.name,
    isRequired: g.isRequired,
    sortOrder: g.sortOrder,
    options: g.options.map(formatOption),
  };
}

function formatItem(i: {
  id: number;
  name: string;
  description: string | null;
  basePrice: number | { toNumber(): number };
  imageUrl: string | null;
  isAvailable: boolean;
  disableNote: string | null;
  sortOrder: number;
  optionGroups: Array<{
    id: number;
    name: string;
    isRequired: boolean;
    sortOrder: number;
    options: Array<{
      id: number;
      name: string;
      priceModifier: number | { toNumber(): number };
      sortOrder: number;
    }>;
  }>;
}): CustomerMenuItemDto {
  return {
    id: i.id,
    name: i.name,
    description: i.description,
    basePrice: typeof i.basePrice === 'object'
      ? i.basePrice.toNumber()
      : Number(i.basePrice),
    imageUrl: i.imageUrl,
    isAvailable: i.isAvailable,
    // Only expose disableNote when item is unavailable
    disableNote: i.isAvailable ? null : i.disableNote,
    sortOrder: i.sortOrder,
    optionGroups: i.optionGroups.map(formatGroup),
  };
}

// ─── service ───────────────────────────────────────────────────────────────

export const customerMenuService = {
  /**
   * GET /customer/menu — Member JWT
   * Full menu for the member's branch. Branch is always from req.member.branchId.
   * §E: All customer routes derive branchId from req.member — no branch URL param.
   */
  async getFullMenu(member: MemberTokenPayload): Promise<CustomerMenuDto> {
    const categories = await customerMenuRepository.findFullMenu(member.branchId);
    return categories.map(
      (cat): CustomerMenuCategoryDto => ({
        id: cat.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
        items: cat.items.map(formatItem),
      }),
    );
  },

  /**
   * GET /customer/menu/categories — Member JWT
   * Lightweight: categories only, no items. Useful for building a tab bar.
   */
  async getCategories(
    member: MemberTokenPayload,
  ): Promise<Array<{ id: number; name: string; sortOrder: number }>> {
    return customerMenuRepository.findCategories(member.branchId);
  },

  /**
   * GET /customer/menu/items/:itemId — Member JWT
   * Single item detail — used when customer taps an item for customisation.
   */
  async getItemById(
    itemId: number,
    member: MemberTokenPayload,
  ): Promise<CustomerMenuItemDto> {
    const item = await customerMenuRepository.findItemById(itemId, member.branchId);
    if (!item) throw new AppError('Item not found', 404, 'NOT_FOUND');
    return formatItem(item);
  },
};
