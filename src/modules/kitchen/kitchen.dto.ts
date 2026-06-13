export interface KdsItemDto {
  id: number;
  orderId: number;
  menuItemId: number;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  quantity: number;
  note: string | null;
  status: string;
}

export interface KdsOrderDto {
  id: number;
  sessionId: number | null;
  orderType: string;
  isParcel: boolean;
  customerName: string | null;
  tableNumber: number | null;
  sectionName: string | null;
  status: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: KdsItemDto[];
}

/** Queue view: pending + preparing items only, grouped by order */
export interface KdsQueueDto {
  orderId: number;
  tableNumber: number | null;
  orderType: string;
  isParcel: boolean;
  customerName: string | null;
  createdAt: Date;
  pendingItems: KdsItemDto[];
  preparingItems: KdsItemDto[];
}
