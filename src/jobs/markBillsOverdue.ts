import prisma from '../config/database';

/**
 * §G: markBillsOverdue
 * Runs nightly (e.g. 01:00).
 * Marks unpaid bills whose due_date < today as overdue.
 * Also inserts a notification per branch that has overdue bills.
 */
export async function markBillsOverdue(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // start of today

  const updated = await prisma.bill.updateMany({
    where: {
      status: 'unpaid',
      deletedAt: null,
      dueDate: { lt: today },
    },
    data: { status: 'overdue' },
  });

  if (updated.count === 0) return;

  console.log(`[markBillsOverdue] Marked ${updated.count} bill(s) as overdue`);

  // Notify each affected branch once
  const overdueBills = await prisma.bill.findMany({
    where: {
      status: 'overdue',
      deletedAt: null,
      dueDate: { lt: today },
    },
    select: { id: true, branchId: true, type: true, amount: true },
    distinct: ['branchId'],
  });

  for (const bill of overdueBills) {
    const branch = await prisma.branch.findUnique({
      where: { id: bill.branchId },
      select: { restaurantId: true },
    });
    if (!branch) continue;

    // Check for existing unread overdue notification for this branch today
    const todayStart = new Date(today);
    const existing = await prisma.notification.findFirst({
      where: {
        branchId: bill.branchId,
        type: 'bill_overdue',
        createdAt: { gte: todayStart },
        isRead: false,
      },
    });
    if (existing) continue;

    // Count total overdue bills for the message
    const totalOverdue = await prisma.bill.count({
      where: { branchId: bill.branchId, status: 'overdue', deletedAt: null },
    });

    await prisma.notification.create({
      data: {
        restaurantId: branch.restaurantId,
        branchId: bill.branchId,
        type: 'bill_overdue',
        title: 'Overdue bills',
        message: `Branch has ${totalOverdue} overdue bill(s) that require attention.`,
        referenceType: 'bill',
        referenceId: bill.id,
      },
    });
  }
}
