import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { generateInvoiceNumber, recordInvoiceReference } from './invoices.numbering';
import type { InvoiceDto, InvoiceOrderDto, InvoiceLineItemDto } from './invoices.dto';

// ─── helpers ───────────────────────────────────────────────────────────────

function toNum(v: number | { toNumber(): number } | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'object' ? v.toNumber() : Number(v);
}

function buildLineItem(i: {
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  quantity: number;
  unitPrice: number | { toNumber(): number };
  status: string;
}): InvoiceLineItemDto | null {
  if (i.status === 'cancelled') return null;
  const unitPrice = toNum(i.unitPrice);
  return {
    name: i.itemNameSnapshot,
    variant: i.variantNameSnapshot,
    qty: i.quantity,
    unitPrice,
    subtotal: unitPrice * i.quantity,
  };
}

function buildOrderDto(o: {
  id: number;
  orderType: string;
  items: Array<{
    itemNameSnapshot: string;
    variantNameSnapshot: string | null;
    quantity: number;
    unitPrice: number | { toNumber(): number };
    status: string;
  }>;
}): InvoiceOrderDto {
  const lines = o.items.map(buildLineItem).filter((l): l is InvoiceLineItemDto => l !== null);
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  return { orderId: o.id, orderType: o.orderType, items: lines, subtotal };
}

// ─── session invoice builder ────────────────────────────────────────────────

export async function buildSessionInvoice(
  sessionId: number,
  branchId: number,
): Promise<InvoiceDto> {
  return prisma.$transaction(async (tx) => {
    const session = await tx.diningSession.findFirst({
      where: { id: sessionId, branchId },
      include: {
        table: {
          include: { section: { select: { name: true } } },
        },
        members: { select: { id: true } },
        orders: {
          where: { deletedAt: null },
          include: {
            items: { where: { deletedAt: null }, orderBy: { id: 'asc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          where: { status: { in: ['completed', 'refunded'] } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!session) throw new AppError('Session not found', 404, 'NOT_FOUND');

    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: { name: true, address: true, phone: true },
    });

    const orderDtos = session.orders.map(buildOrderDto);
    const subtotal  = orderDtos.reduce((s, o) => s + o.subtotal, 0);
    const tax       = 0; // v1: no tax calculation
    const total     = subtotal + tax;

    const paymentSummary = session.payments.map((p) => ({
      method: p.method,
      amount: toNum(p.amount),
      status: p.status,
    }));

    const totalPaid = paymentSummary.reduce(
      (s, p) => s + (p.status === 'completed' ? p.amount : 0),
      0,
    );
    const totalRefunded = paymentSummary.reduce(
      (s, p) => s + (p.status === 'refunded' ? Math.abs(p.amount) : 0),
      0,
    );
    const balanceDue = Math.max(0, total - (totalPaid - totalRefunded));

    // Generate invoice number + persist reference atomically
    const invoiceNumber = await generateInvoiceNumber(branchId, tx);
    await recordInvoiceReference(
      {
        invoiceNumber,
        branchId,
        sessionId,
        totalAmount: total,
      },
      tx,
    );

    return {
      invoiceNumber,
      issuedAt: new Date(),
      branch: {
        name: branch!.name,
        address: branch!.address,
        phone: branch!.phone,
      },
      table: session.table
        ? {
            tableNo: `T-${String(session.table.tableNumber).padStart(2, '0')}`,
            section: session.table.section.name,
          }
        : null,
      session: {
        id: session.id,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      },
      members: session.members.length,
      orders: orderDtos,
      subtotal,
      tax,
      total,
      payments: paymentSummary,
      balanceDue,
    };
  });
}

// ─── single-order invoice builder ──────────────────────────────────────────

export async function buildOrderInvoice(
  orderId: number,
  branchId: number,
): Promise<InvoiceDto> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, branchId, deletedAt: null },
      include: {
        items: { where: { deletedAt: null }, orderBy: { id: 'asc' } },
        payments: {
          where: { status: { in: ['completed', 'refunded'] } },
          orderBy: { createdAt: 'asc' },
        },
        session: {
          include: {
            table: { include: { section: { select: { name: true } } } },
            members: { select: { id: true } },
          },
        },
      },
    });
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: { name: true, address: true, phone: true },
    });

    const orderDto = buildOrderDto(order);
    const subtotal = orderDto.subtotal;
    const tax      = 0;
    const total    = subtotal + tax;

    const paymentSummary = order.payments.map((p) => ({
      method: p.method,
      amount: toNum(p.amount),
      status: p.status,
    }));

    const totalPaid     = paymentSummary.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
    const totalRefunded = paymentSummary.filter((p) => p.status === 'refunded').reduce((s, p) => s + Math.abs(p.amount), 0);
    const balanceDue    = Math.max(0, total - (totalPaid - totalRefunded));

    const invoiceNumber = await generateInvoiceNumber(branchId, tx);
    await recordInvoiceReference(
      {
        invoiceNumber,
        branchId,
        sessionId: order.sessionId,
        orderId,
        totalAmount: total,
        issuedTo: order.customerName,
      },
      tx,
    );

    return {
      invoiceNumber,
      issuedAt: new Date(),
      branch: {
        name: branch!.name,
        address: branch!.address,
        phone: branch!.phone,
      },
      table: order.session?.table
        ? {
            tableNo: `T-${String(order.session.table.tableNumber).padStart(2, '0')}`,
            section: order.session.table.section.name,
          }
        : null,
      session: order.session
        ? {
            id: order.session.id,
            startedAt: order.session.startedAt,
            completedAt: order.session.completedAt,
          }
        : null,
      members: order.session?.members.length ?? 0,
      orders: [orderDto],
      subtotal,
      tax,
      total,
      payments: paymentSummary,
      balanceDue,
    };
  });
}
