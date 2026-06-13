/** Matches the §F6 invoice response shape. */
export interface InvoiceLineItemDto {
  name: string;
  variant: string | null;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface InvoiceOrderDto {
  orderId: number;
  orderType: string;
  items: InvoiceLineItemDto[];
  subtotal: number;
}

export interface InvoiceDto {
  invoiceNumber: string;
  issuedAt: Date;
  branch: {
    name: string;
    address: string | null;
    phone: string | null;
  };
  table: {
    tableNo: string;
    section: string;
  } | null;
  session: {
    id: number;
    startedAt: Date;
    completedAt: Date | null;
  } | null;
  members: number;
  orders: InvoiceOrderDto[];
  subtotal: number;
  tax: number;
  total: number;
  payments: Array<{
    method: string;
    amount: number;
    status: string;
  }>;
  balanceDue: number;
}
