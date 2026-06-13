import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import type { InvoiceDto } from './invoices.dto';

/**
 * Streams a PDF invoice directly to the HTTP response.
 * Uses pdfkit; no temp file — pipe straight to res.
 * §F6: streamed as Content-Type: application/pdf
 */
export function streamInvoicePdf(res: Response, invoice: InvoiceDto): void {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${invoice.invoiceNumber}.pdf"`,
  );
  doc.pipe(res);

  // ── Header ──────────────────────────────────────────────────────────────
  doc.fontSize(20).font('Helvetica-Bold').text(invoice.branch.name, { align: 'center' });
  if (invoice.branch.address) {
    doc.fontSize(10).font('Helvetica').text(invoice.branch.address, { align: 'center' });
  }
  if (invoice.branch.phone) {
    doc.text(`Phone: ${invoice.branch.phone}`, { align: 'center' });
  }
  doc.moveDown();

  // ── Invoice meta ────────────────────────────────────────────────────────
  doc.fontSize(14).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Invoice No: ${invoice.invoiceNumber}`);
  doc.text(`Issued At:  ${invoice.issuedAt.toLocaleString()}`);
  if (invoice.table) {
    doc.text(`Table:      ${invoice.table.tableNo} — ${invoice.table.section}`);
  }
  if (invoice.session) {
    doc.text(`Session:    #${invoice.session.id}`);
    doc.text(`Started:    ${invoice.session.startedAt.toLocaleString()}`);
  }
  doc.text(`Guests:     ${invoice.members}`);
  doc.moveDown();

  // ── Order line items ─────────────────────────────────────────────────────
  const colX = { item: 50, qty: 290, unit: 350, sub: 450 };

  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Item', colX.item, doc.y);
  doc.text('Qty', colX.qty, doc.y - doc.currentLineHeight());
  doc.text('Unit', colX.unit, doc.y - doc.currentLineHeight());
  doc.text('Total', colX.sub, doc.y - doc.currentLineHeight());
  doc.moveDown(0.3);

  // Divider
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor('#cccccc')
    .stroke();
  doc.moveDown(0.3);

  doc.font('Helvetica').fontSize(9);
  for (const order of invoice.orders) {
    if (invoice.orders.length > 1) {
      doc.font('Helvetica-Bold').text(`Order #${order.orderId} (${order.orderType})`);
      doc.font('Helvetica');
    }
    for (const line of order.items) {
      const label = line.variant ? `${line.name} (${line.variant})` : line.name;
      const y = doc.y;
      doc.text(label, colX.item, y, { width: 230 });
      doc.text(String(line.qty), colX.qty, y);
      doc.text(`Rs ${line.unitPrice.toFixed(2)}`, colX.unit, y);
      doc.text(`Rs ${line.subtotal.toFixed(2)}`, colX.sub, y);
      doc.moveDown(0.2);
    }
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.5);

  const totalsX = 380;
  doc.font('Helvetica').fontSize(10);
  doc.text('Subtotal:', totalsX);
  doc.text(`Rs ${invoice.subtotal.toFixed(2)}`, colX.sub, doc.y - doc.currentLineHeight());

  if (invoice.tax > 0) {
    doc.text('Tax:', totalsX);
    doc.text(`Rs ${invoice.tax.toFixed(2)}`, colX.sub, doc.y - doc.currentLineHeight());
  }

  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Total:', totalsX);
  doc.text(`Rs ${invoice.total.toFixed(2)}`, colX.sub, doc.y - doc.currentLineHeight());
  doc.moveDown(0.5);

  // ── Payments ─────────────────────────────────────────────────────────────
  if (invoice.payments.length > 0) {
    doc.font('Helvetica').fontSize(10);
    for (const p of invoice.payments) {
      const sign = p.status === 'refunded' ? '-' : '';
      doc.text(`${p.method.toUpperCase()} (${p.status}): Rs ${sign}${Math.abs(p.amount).toFixed(2)}`);
    }
    doc.moveDown(0.3);
  }

  doc.font('Helvetica-Bold').fontSize(11);
  const balanceLabel = invoice.balanceDue > 0 ? 'Balance Due:' : 'Paid In Full';
  doc.text(balanceLabel, totalsX);
  if (invoice.balanceDue > 0) {
    doc.text(`Rs ${invoice.balanceDue.toFixed(2)}`, colX.sub, doc.y - doc.currentLineHeight());
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  doc.moveDown(2);
  doc.fontSize(9).font('Helvetica').fillColor('#888888')
    .text('Thank you for dining with us!', { align: 'center' });

  doc.end();
}
