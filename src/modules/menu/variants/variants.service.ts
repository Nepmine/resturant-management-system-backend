import prisma from '../../../config/database';
import { AppError } from '../../../middleware/errorHandler';
import { itemRepository } from '../items/items.repository';
import { variantRepository } from './variants.repository';
import type {
  CreateVariantDto,
  UpdateVariantDto,
  CreateOptionDto,
  UpdateOptionDto,
  VariantGroupDto,
  OptionDto,
} from './variants.dto';

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
    priceModifier: typeof o.priceModifier === 'object'
      ? o.priceModifier.toNumber()
      : Number(o.priceModifier),
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
}): VariantGroupDto {
  return {
    id: g.id,
    menuItemId: g.menuItemId,
    name: g.name,
    isRequired: g.isRequired,
    sortOrder: g.sortOrder,
    options: g.options.map(formatOption),
  };
}

// ─── guards ────────────────────────────────────────────────────────────────

async function assertItemInBranch(itemId: number, branchId: number) {
  const item = await itemRepository.findByIdAndBranch(itemId, branchId);
  if (!item) throw new AppError('Menu item not found', 404, 'NOT_FOUND');
  return item;
}

async function assertGroup(groupId: number, itemId: number) {
  const group = await variantRepository.findGroupById(groupId, itemId);
  if (!group) throw new AppError('Variant group not found', 404, 'NOT_FOUND');
  return group;
}

async function assertOption(optionId: number, groupId: number) {
  const option = await variantRepository.findOptionById(optionId, groupId);
  if (!option) throw new AppError('Option not found', 404, 'NOT_FOUND');
  return option;
}

// ─── service ───────────────────────────────────────────────────────────────

export const variantService = {
  /**
   * POST /menu/items/:itemId/variants — Manager+
   * Creates an option group and optionally seeds it with initial options.
   * §B2.11–B2.12: group (e.g. "Type") + options (e.g. "Steam", "Fried").
   */
  async createGroup(
    itemId: number,
    branchId: number,
    dto: CreateVariantDto,
  ): Promise<VariantGroupDto> {
    await assertItemInBranch(itemId, branchId);

    return prisma.$transaction(async (tx) => {
      const { options, ...groupData } = dto;

      const group = await variantRepository.createGroup(
        { menuItemId: itemId, ...groupData },
        tx,
      );

      if (options && options.length > 0) {
        await variantRepository.createManyOptions(
          options.map((o) => ({ groupId: group.id, ...o })),
          tx,
        );
      }

      // Re-fetch with fresh options list after createMany
      const fresh = await variantRepository.findGroupById(group.id, itemId, tx);
      return formatGroup(fresh!);
    });
  },

  /**
   * PATCH /menu/items/:itemId/variants/:variantId — Manager+
   * Updates group-level fields only (name, isRequired, sortOrder).
   */
  async updateGroup(
    groupId: number,
    itemId: number,
    branchId: number,
    dto: UpdateVariantDto,
  ): Promise<VariantGroupDto> {
    await assertItemInBranch(itemId, branchId);
    await assertGroup(groupId, itemId);

    const updated = await variantRepository.updateGroup(groupId, dto);
    return formatGroup(updated);
  },

  /**
   * DELETE /menu/items/:itemId/variants/:variantId — Manager+
   * Soft-deletes the group AND all its child options atomically.
   */
  async softDeleteGroup(
    groupId: number,
    itemId: number,
    branchId: number,
  ): Promise<void> {
    await assertItemInBranch(itemId, branchId);
    await assertGroup(groupId, itemId);
    await variantRepository.softDeleteGroup(groupId);
  },

  // ─── Option-level operations ─────────────────────────────────────────────

  /**
   * POST /menu/items/:itemId/variants/:variantId/options — Manager+
   * Adds a single option to an existing group.
   */
  async createOption(
    groupId: number,
    itemId: number,
    branchId: number,
    dto: CreateOptionDto,
  ): Promise<OptionDto> {
    await assertItemInBranch(itemId, branchId);
    await assertGroup(groupId, itemId);

    const option = await variantRepository.createOption({
      groupId,
      ...dto,
    });
    return formatOption(option);
  },

  /**
   * PATCH /menu/items/:itemId/variants/:variantId/options/:optionId — Manager+
   */
  async updateOption(
    optionId: number,
    groupId: number,
    itemId: number,
    branchId: number,
    dto: UpdateOptionDto,
  ): Promise<OptionDto> {
    await assertItemInBranch(itemId, branchId);
    await assertGroup(groupId, itemId);
    await assertOption(optionId, groupId);

    const updated = await variantRepository.updateOption(optionId, dto);
    return formatOption(updated);
  },

  /**
   * DELETE /menu/items/:itemId/variants/:variantId/options/:optionId — Manager+
   * Prevents deleting the last option in a required group, since that would
   * leave customers with a required choice they cannot fulfill.
   */
  async softDeleteOption(
    optionId: number,
    groupId: number,
    itemId: number,
    branchId: number,
  ): Promise<void> {
    await assertItemInBranch(itemId, branchId);
    const group = await assertGroup(groupId, itemId);
    await assertOption(optionId, groupId);

    if (group.isRequired) {
      const count = await variantRepository.countActiveOptions(groupId);
      if (count <= 1) {
        throw new AppError(
          'Cannot delete the last option in a required group. Add another option first, or make the group optional.',
          409,
          'LAST_REQUIRED_OPTION',
        );
      }
    }

    await variantRepository.softDeleteOption(optionId);
  },
};
