import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { branchRepository } from './branches.repository';
import type { CreateBranchDto, UpdateBranchDto, BranchDto } from './branches.dto';
import type { AuthenticatedStaffRequest } from '../../types/express';

function formatBranch(b: {
  id: number;
  restaurantId: number;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
}): BranchDto {
  return {
    id: b.id,
    restaurantId: b.restaurantId,
    name: b.name,
    address: b.address,
    phone: b.phone,
    isActive: b.isActive,
    createdAt: b.createdAt,
  };
}

export const branchService = {
  /**
   * List branches.
   * - staff role: only their assigned branch (branchId from JWT)
   * - manager/admin: all branches in the restaurant
   */
  async list(req: AuthenticatedStaffRequest): Promise<BranchDto[]> {
    const { restaurantId, role, branchId } = req.user!;

    if (role === 'staff' && branchId !== null) {
      const branch = await branchRepository.findById(branchId, restaurantId);
      return branch ? [formatBranch(branch)] : [];
    }

    const branches = await branchRepository.findAll(restaurantId);
    return branches.map(formatBranch);
  },

  async getById(branchId: number, restaurantId: number): Promise<BranchDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');
    return formatBranch(branch);
  },

  /**
   * Create branch with row-level lock to enforce max_branches from subscription.
   * §B2.3: SELECT ... FOR UPDATE on subscriptions prevents race conditions between
   * two concurrent requests trying to create the nth+1 branch.
   */
  async create(restaurantId: number, dto: CreateBranchDto): Promise<BranchDto> {
    return prisma.$transaction(async (tx) => {
      // Acquire row-level lock on the subscription row
      const subscriptions = await tx.$queryRaw<
        Array<{
          id: number;
          status: string;
          max_branches: number;
          grace_expires_at: Date | null;
        }>
      >`
        SELECT id, status, max_branches, grace_expires_at
        FROM subscriptions
        WHERE restaurant_id = ${restaurantId}
          AND (
            status = 'active'
            OR (status = 'grace_period' AND grace_expires_at > now())
          )
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `;

      const subscription = subscriptions[0];
      if (!subscription) {
        throw new AppError('No active subscription', 402, 'NO_ACTIVE_SUBSCRIPTION');
      }

      const currentCount = await branchRepository.countActive(restaurantId, tx);
      if (currentCount >= subscription.max_branches) {
        throw new AppError(
          `Plan allows max ${subscription.max_branches} branch(es)`,
          403,
          'BRANCH_LIMIT_REACHED',
        );
      }

      const branch = await branchRepository.create(
        { restaurantId, ...dto },
        tx,
      );

      return formatBranch(branch);
    });
  },

  async update(branchId: number, restaurantId: number, dto: UpdateBranchDto): Promise<BranchDto> {
    const existing = await branchRepository.findById(branchId, restaurantId);
    if (!existing) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    const updated = await branchRepository.update(branchId, dto);
    return formatBranch(updated);
  },

  async toggle(branchId: number, restaurantId: number): Promise<BranchDto> {
    const existing = await branchRepository.findById(branchId, restaurantId);
    if (!existing) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    const updated = await branchRepository.setActive(branchId, !existing.isActive);
    return formatBranch(updated);
  },

  async softDelete(branchId: number, restaurantId: number): Promise<void> {
    const existing = await branchRepository.findById(branchId, restaurantId);
    if (!existing) throw new AppError('Branch not found', 404, 'NOT_FOUND');
    await branchRepository.softDelete(branchId);
  },
};
