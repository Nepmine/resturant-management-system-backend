import { AppError } from '../../middleware/errorHandler';
import { branchRepository } from '../branches/branches.repository';
import { buildSessionInvoice, buildOrderInvoice } from './invoices.builder';
import type { InvoiceDto } from './invoices.dto';

export const invoiceService = {
  async getSessionInvoice(
    sessionId: number,
    branchId: number,
    restaurantId: number,
  ): Promise<InvoiceDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');
    return buildSessionInvoice(sessionId, branchId);
  },

  async getOrderInvoice(
    orderId: number,
    branchId: number,
    restaurantId: number,
  ): Promise<InvoiceDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');
    return buildOrderInvoice(orderId, branchId);
  },
};
