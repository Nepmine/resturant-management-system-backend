import { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

/**
 * §F5: Invoice numbers are generated transactionally inside the same
 * transaction that inserts the invoice_references row.
 *
 * Format: INV-{YYYY}-{branchId}-{NNNNN}
 * NNNNN is a zero-padded 5-digit per-branch sequence.
 *
 * FOR UPDATE on the last row serializes concurrent invoice creation per branch.
 */
export async function generateInvoiceNumber(
  branchId: number,
  tx: TxClient,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ invoice_number: string }>>`
    SELECT invoice_number
    FROM invoice_references
    WHERE branch_id = ${branchId}
    ORDER BY id DESC
    LIMIT 1
    FOR UPDATE
  `;

  const lastSeq = rows[0]
    ? parseInt(rows[0].invoice_number.split('-')[3] ?? '0', 10)
    : 0;

  const nextSeq = String(lastSeq + 1).padStart(5, '0');
  const year = new Date().getFullYear();

  return `INV-${year}-${branchId}-${nextSeq}`;
}

/**
 * Insert an invoice_references row and return the invoice number.
 * Must be called inside a transaction AFTER generateInvoiceNumber.
 */
export async function recordInvoiceReference(
  params: {
    invoiceNumber: string;
    branchId: number;
    sessionId?: number | null;
    orderId?: number | null;
    totalAmount: number;
    issuedTo?: string | null;
  },
  tx: TxClient,
) {
  return tx.invoiceReference.create({
    data: {
      invoiceNumber: params.invoiceNumber,
      branchId: params.branchId,
      sessionId: params.sessionId ?? null,
      orderId: params.orderId ?? null,
      totalAmount: params.totalAmount,
      issuedAt: new Date(),
      issuedTo: params.issuedTo ?? null,
    },
  });
}
