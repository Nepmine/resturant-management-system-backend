import prisma from '../../config/database';

export const customerMenuRepository = {
  /**
   * Full menu for a branch — all non-deleted categories with their non-deleted items.
   * Unavailable items ARE included (customer sees them greyed out with disableNote).
   * Deleted items and categories are excluded.
   */
  async findFullMenu(branchId: number) {
    return prisma.menuCategory.findMany({
      where: { branchId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            optionGroups: {
              where: { deletedAt: null },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: {
                options: {
                  where: { deletedAt: null },
                  orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                },
              },
            },
          },
        },
      },
    });
  },

  /** Categories only — no items (lighter payload for category nav). */
  async findCategories(branchId: number) {
    return prisma.menuCategory.findMany({
      where: { branchId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, sortOrder: true },
    });
  },

  /** Single item detail with full option groups. */
  async findItemById(itemId: number, branchId: number) {
    return prisma.menuItem.findFirst({
      where: {
        id: itemId,
        deletedAt: null,
        category: { branchId, deletedAt: null },
      },
      include: {
        optionGroups: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            options: {
              where: { deletedAt: null },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });
  },
};
