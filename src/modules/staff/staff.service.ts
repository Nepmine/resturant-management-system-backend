import { AppError } from '../../middleware/errorHandler';
import { buildMeta, parsePagination } from '../../utils/pagination';
import { staffRepository } from './staff.repository';
import type {
  InviteStaffDto,
  UpdateRoleDto,
  StaffDto,
  ActivityLogDto,
} from './staff.dto';

function formatStaff(s: {
  id: number; name: string; email: string; role: string;
  branchId: number | null; isActive: boolean;
  oauthProvider: string; createdAt: Date;
}): StaffDto {
  return {
    id: s.id, name: s.name, email: s.email, role: s.role,
    branchId: s.branchId, isActive: s.isActive,
    oauthProvider: s.oauthProvider, createdAt: s.createdAt,
  };
}

function formatLog(l: {
  id: number; staffId: number; branchId: number | null;
  actionType: string; targetType: string; targetId: number;
  meta: unknown; createdAt: Date;
}): ActivityLogDto {
  return {
    id: l.id, staffId: l.staffId, branchId: l.branchId,
    actionType: l.actionType, targetType: l.targetType,
    targetId: l.targetId, meta: l.meta, createdAt: l.createdAt,
  };
}

export const staffService = {
  async list(restaurantId: number, query: Record<string, string | undefined>) {
    const { skip, take } = parsePagination(query);
    const { rows, total } = await staffRepository.findAll(restaurantId, { skip, take });
    return { data: rows.map(formatStaff), meta: buildMeta(total, skip, take) };
  },

  /**
   * POST /staff/invite — Admin
   * §D14: Pre-creates a record with is_active = false (whitelist pending).
   * Staff cannot log in until whitelisted via POST /staff/:id/whitelist.
   * §C4: No self-signup; Google OAuth only sets oauth_id after whitelist.
   */
  async invite(restaurantId: number, dto: InviteStaffDto): Promise<StaffDto> {
    const existing = await staffRepository.findByEmail(dto.email, restaurantId);
    if (existing) throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');

    const staff = await staffRepository.create({
      restaurantId,
      name: dto.name,
      email: dto.email,
      role: dto.role,
      branchId: dto.branchId ?? null,
      oauthProvider: 'google',
      oauthId: `pending-${dto.email}`, // placeholder until first OAuth login sets real ID
    });
    return formatStaff(staff);
  },

  async whitelist(staffId: number, restaurantId: number): Promise<StaffDto> {
    const staff = await staffRepository.findById(staffId, restaurantId);
    if (!staff) throw new AppError('Staff not found', 404, 'NOT_FOUND');
    if (staff.isActive) throw new AppError('Staff is already active', 409, 'ALREADY_ACTIVE');
    const updated = await staffRepository.setActive(staffId, true);
    return formatStaff(updated);
  },

  async suspend(staffId: number, restaurantId: number): Promise<StaffDto> {
    const staff = await staffRepository.findById(staffId, restaurantId);
    if (!staff) throw new AppError('Staff not found', 404, 'NOT_FOUND');
    const updated = await staffRepository.setActive(staffId, false);
    return formatStaff(updated);
  },

  async updateRole(
    staffId: number,
    restaurantId: number,
    dto: UpdateRoleDto,
  ): Promise<StaffDto> {
    const staff = await staffRepository.findById(staffId, restaurantId);
    if (!staff) throw new AppError('Staff not found', 404, 'NOT_FOUND');
    const updated = await staffRepository.updateRole(staffId, {
      role: dto.role,
      branchId: dto.branchId !== undefined ? dto.branchId : staff.branchId,
    });
    return formatStaff(updated);
  },

  async softDelete(staffId: number, restaurantId: number): Promise<void> {
    const staff = await staffRepository.findById(staffId, restaurantId);
    if (!staff) throw new AppError('Staff not found', 404, 'NOT_FOUND');
    await staffRepository.softDelete(staffId);
  },

  async getLogs(
    staffId: number,
    restaurantId: number,
    query: Record<string, string | undefined>,
  ) {
    const staff = await staffRepository.findById(staffId, restaurantId);
    if (!staff) throw new AppError('Staff not found', 404, 'NOT_FOUND');
    const { skip, take } = parsePagination(query);
    const { rows, total } = await staffRepository.findLogs(staffId, { skip, take });
    return { data: rows.map(formatLog), meta: buildMeta(total, skip, take) };
  },
};
