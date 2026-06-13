import PDFDocument from 'pdfkit';
import { Response } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// src/utils/pdf.ts
// Generates invoice PDFs on-demand and streams them directly to the HTTP
// response. Invoices are NEVER stored — only invoice_references rows are kept
// for accounting (§F6, §PART 0 DATA INTEGRITY).
//
// Requires: pdfkit  →  npm install pdfkit @types/pdfkit
// ─────────────────────────────────────────────────────────────────────────────

// ── Data shapes ───────────────────────────────────────────────────────────────

export interface InvoiceItemLine {
  name: string;
  variant: string | null;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface InvoiceOrder {
  orderId: number;
  orderType: 'dine_in' | 'parcel';
  items: InvoiceItemLine[];
  subtotal: number;
}

export interface InvoicePaymentLine {
  method: string;
  amount: number;
  status: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: Date;
  branch: {
    name: string;
    address: string | null;
    phone: string | null;
  };
  table: {
    tableNo: number;
    section: string;
  } | null;
  session: {
    id: number;
    startedAt: Date;
    completedAt: Date | null;
  } | null;
  members: number;
  orders: InvoiceOrder[];
  subtotal: number;
  tax: number;
  total: number;
  payments: InvoicePaymentLine[];
  balanceDue: number;
  issuedTo?: string | null;
}

// ── PDF stream helper ─────────────────────────────────────────────────────────

/**
 * Generate an invoice PDF and stream it to the Express Response.
 * Sets Content-Type, Content-Disposition, and pipes the PDFDocument.
 *
 * Usage:
 *   await streamInvoicePdf(res, invoiceData);
 *   // Do NOT call res.end() — the pipe handles it.
 */
export async function streamInvoicePdf(
  res: Response,
  data: InvoiceData,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${data.invoiceNumber}.pdf"`,
    );

    doc.pipe(res);
    doc.on('end', resolve);
    doc.on('error', reject);

    renderInvoice(doc, data);

    doc.end();
  });
}

// ── Internal renderer ─────────────────────────────────────────────────────────

function renderInvoice(doc: PDFKit.PDFDocument, data: InvoiceData): void {
  const LEFT = 50;
  const RIGHT = doc.page.width - 50;
  const COL_QTY = RIGHT - 180;
  const COL_UNIT = RIGHT - 120;
  const COL_TOTAL = RIGHT;

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.fontSize(20).font('Helvetica-Bold').text(data.branch.name, LEFT, 50);
  doc.fontSize(9).font('Helvetica');
  if (data.branch.address) doc.text(data.branch.address);
  if (data.branch.phone) doc.text(`Tel: ${data.branch.phone}`);

  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
  doc.fontSize(9).font('Helvetica');
  doc.text(`Invoice #: ${data.invoiceNumber}`, { align: 'right' });
  doc.text(`Date: ${data.issuedAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}`, { align: 'right' });
  if (data.issuedTo) doc.text(`Issued to: ${data.issuedTo}`, { align: 'right' });

  // ── Table / Session info ────────────────────────────────────────────────────
  doc.moveDown();
  doc.font('Helvetica-Bold').fontSize(9);
  if (data.table) {
    doc.text(`Table: ${data.table.tableNo}  |  Section: ${data.table.section}`);
  }
  if (data.session) {
    doc.font('Helvetica').text(
      `Session #${data.session.id}  |  Started: ${data.session.startedAt.toLocaleTimeString()}` +
        (data.session.completedAt
          ? `  |  Completed: ${data.session.completedAt.toLocaleTimeString()}`
          : ''),
    );
  }
  doc.text(`Guests: ${data.members}`);

  // ── Divider ────────────────────────────────────────────────────────────────
  doc.moveDown(0.5);
  drawHRule(doc, LEFT, RIGHT);

  // ── Column headers ─────────────────────────────────────────────────────────
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Item', LEFT, doc.y, { continued: false, width: COL_QTY - LEFT - 10 });
  const headerY = doc.y - doc.currentLineHeight();
  doc.text('Qty', COL_QTY, headerY, { width: 40, align: 'right' });
  doc.text('Unit', COL_UNIT - 40, headerY, { width: 40, align: 'right' });
  doc.text('Total', COL_TOTAL - 60, headerY, { width: 60, align: 'right' });

  drawHRule(doc, LEFT, RIGHT);

  // ── Order lines ────────────────────────────────────────────────────────────
  doc.font('Helvetica').fontSize(9);
  for (const order of data.orders) {
    if (data.orders.length > 1) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text(
        `Order #${order.orderId} (${order.orderType.replace('_', '-')})`,
        LEFT,
      );
      doc.font('Helvetica');
    }

    for (const line of order.items) {
      const label = line.variant
        ? `${line.name} — ${line.variant}`
        : line.name;
      const y = doc.y;
      doc.text(label, LEFT, y, { width: COL_QTY - LEFT - 10 });
      const lineY = doc.y - doc.currentLineHeight();
      doc.text(String(line.qty), COL_QTY, lineY, { width: 40, align: 'right' });
      doc.text(formatNPR(line.unitPrice), COL_UNIT - 40, lineY, { width: 40, align: 'right' });
      doc.text(formatNPR(line.subtotal), COL_TOTAL - 60, lineY, { width: 60, align: 'right' });
    }
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  drawHRule(doc, LEFT, RIGHT);
  doc.moveDown(0.3);

  renderTotalRow(doc, 'Subtotal', data.subtotal, RIGHT);
  if (data.tax > 0) {
    renderTotalRow(doc, 'Tax', data.tax, RIGHT);
  }
  doc.font('Helvetica-Bold');
  renderTotalRow(doc, 'TOTAL', data.total, RIGHT);

  if (data.payments.length > 0) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(9).text('Payments received:', LEFT);
    doc.font('Helvetica');
    for (const p of data.payments) {
      doc.text(
        `  ${p.method.toUpperCase()} — ${formatNPR(p.amount)} (${p.status})`,
        LEFT,
      );
    }
  }

  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(10);
  const balanceColor = data.balanceDue > 0 ? '#cc0000' : '#007700';
  doc.fillColor(balanceColor).text(`Balance Due: ${formatNPR(data.balanceDue)}`, LEFT);
  doc.fillColor('#000000');

  // ── Footer ─────────────────────────────────────────────────────────────────
  doc.fontSize(8).font('Helvetica').fillColor('#888888');
  doc.text('Thank you for dining with us!', LEFT, doc.page.height - 60, {
    align: 'center',
    width: RIGHT - LEFT,
  });
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatNPR(amount: number): string {
  return `Rs. ${amount.toFixed(2)}`;
}

function drawHRule(doc: PDFKit.PDFDocument, left: number, right: number): void {
  doc
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .strokeColor('#cccccc')
    .stroke();
  doc.moveDown(0.3);
}

function renderTotalRow(
  doc: PDFKit.PDFDocument,
  label: string,
  amount: number,
  right: number,
): void {
  const y = doc.y;
  doc.text(label, right - 160, y, { width: 100, align: 'right' });
  doc.text(formatNPR(amount), right - 60, y, { width: 60, align: 'right' });
}
