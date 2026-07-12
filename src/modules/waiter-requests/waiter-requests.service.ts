import { AppError } from '../../middleware/errorHandler';
import { branchRepository } from '../branches/branches.repository';
import { waiterRequestRepository } from './waiter-requests.repository';
import type { WaiterRequestDto } from './waiter-requests.dto';

function format(r: {
  id: number;
  sessionId: number;
  type: string;
  status: string;
  resolvedById: number | null;
  resolvedAt: Date | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
}): WaiterRequestDto {
  return {
    id: r.id,
    sessionId: r.sessionId,
    type: r.type,
    status: r.status,
    resolvedBy: r.resolvedById,
    resolvedAt: r.resolvedAt,
    acknowledgedAt: r.acknowledgedAt,
    createdAt: r.createdAt,
  };
}

export const waiterRequestService = {
  async list(
    branchId: number,
    restaurantId: number,
    filters: { status?: string; updatedAfter?: Date },
  ): Promise<WaiterRequestDto[]> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');
    const rows = await waiterRequestRepository.findByBranch(branchId, filters);
    return rows.map(format);
  },

  async acknowledge(
    requestId: number,
    branchId: number,
    restaurantId: number,
  ): Promise<WaiterRequestDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');
    const req = await waiterRequestRepository.findById(requestId);
    if (!req) throw new AppError('Request not found', 404, 'NOT_FOUND');
    if (req.status !== 'pending') {
      throw new AppError(`Request is already ${req.status}`, 409, 'INVALID_TRANSITION');
    }
    const updated = await waiterRequestRepository.acknowledge(requestId);
    return format(updated);
  },

  async resolve(
    requestId: number,
    branchId: number,
    restaurantId: number,
    staffId: number,
  ): Promise<WaiterRequestDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');
    const req = await waiterRequestRepository.findById(requestId);
    if (!req) throw new AppError('Request not found', 404, 'NOT_FOUND');
    if (req.status === 'resolved') {
      throw new AppError('Request is already resolved', 409, 'ALREADY_RESOLVED');
    }
    const updated = await waiterRequestRepository.resolve(requestId, staffId);
    return format(updated);
  },
};
