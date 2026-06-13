import prisma from '../config/database';

/**
 * §G: lowStockAlerts
 * Runs every 6 hours.
 * Finds inventory items at or below their low_stock_threshold and
 * inserts a notification for each branch that has such items.
 *
 * Deduplication: only inserts a new notification if no unread low_stock
 * notification already exists for the same item (prevents alert flooding).
 */
export async function lowStockAlerts(): Promise<void> {
  const lowItems = await prisma.$queryRaw<
    Array<{
      id: number;
      branch_id: number;
      name: string;
      quantity: number;
      low_stock_threshold: number;
      unit: string;
    }>
  >`
    SELECT ii.id, ii.branch_id, ii.name, ii.quantity::FLOAT,
           ii.low_stock_threshold::FLOAT, ii.unit
    FROM inventory_items ii
    WHERE ii.deleted_at IS NULL
      AND ii.low_stock_threshold > 0
      AND ii.quantity <= ii.low_stock_threshold
  `;

  if ((lowItems as any[]).length === 0) return;

  // Group by branch
  const byBranch = new Map<number, typeof lowItems>();
  for (const item of lowItems as any[]) {
    if (!byBranch.has(item.branch_id)) byBranch.set(item.branch_id, []);
    byBranch.get(item.branch_id)!.push(item);
  }

  for (const [branchId, items] of byBranch) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { restaurantId: true },
    });
    if (!branch) continue;

    for (const item of items) {
      // Check for existing unread low_stock notification for this item
      const existing = await prisma.notification.findFirst({
        where: {
          branchId,
          type: 'low_stock',
          referenceType: 'inventory_item',
          referenceId: item.id,
          isRead: false,
        },
      });
      if (existing) continue; // Already notified, don't spam

      await prisma.notification.create({
        data: {
          restaurantId: branch.restaurantId,
          branchId,
          type: 'low_stock',
          title: 'Low stock alert',
          message: `${item.name} is low: ${item.quantity} ${item.unit} remaining (threshold: ${item.low_stock_threshold} ${item.unit})`,
          referenceType: 'inventory_item',
          referenceId: item.id,
        },
      });
    }

    console.log(`[lowStockAlerts] Branch ${branchId}: ${items.length} low-stock item(s) notified`);
  }
}
