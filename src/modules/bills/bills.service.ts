import { AppError } from '../../middleware/errorHandler';
import { buildMeta, parsePagination } from '../../utils/pagination';
import { branchRepository } from '../branches/branches.repository';
import { billRepository } from './bills.repository';
import type { CreateBillDto, UpdateBillDto, BillDto } from './bills.dto';

function format(b: {
  id: number; branchId: number; type: string; status: string;
  amount: number | { toNumber(): number };
  dueDate: Date; paidDate: Date | null;
  note: string | null; createdAt: Date;
}): BillDto {
  return {
    id: b.id, branchId: b.branchId, type: b.type, status: b.status,
    amount: typeof b.amount === 'object' ? b.amount.toNumber() : Number(b.amount),
    dueDate: b.dueDate instanceof Date ? b.dueDate.toISOString().slice(0, 10) : String(b.dueDate),
    paidDate: b.paidDate
      ? (b.paidDate instanceof Date ? b.paidDate.toISOString().slice(0, 10) : String(b.paidDate))
      : null,
    note: b.note, createdAt: b.createdAt,
  };
}

async function assertBranch(branchId: number, restaurantId: number) {
  const b = await branchRepository.findById(branchId, restaurantId);
  if (!b) throw new AppError('Branch not found', 404, 'NOT_FOUND');
}

export const billService = {
  async list(branchId: number, restaurantId: number, query: Record<string, string | undefined>) {
    await assertBranch(branchId, restaurantId);
    const { skip, take } = parsePagination(query);
    const { rows, total } = await billRepository.findAll(branchId, { status: query.status }, { skip, take });
    return { data: rows.map(format), meta: buildMeta(total, skip, take) };
  },

  async create(branchId: number, restaurantId: number, dto: CreateBillDto): Promise<BillDto> {
    await assertBranch(branchId, restaurantId);
    const bill = await billRepository.create({
      branchId,
      type: dto.type,
      amount: dto.amount,
      dueDate: new Date(dto.dueDate),
      note: dto.note ?? null,
    });
    return format(bill);
  },

  async update(billId: number, branchId: number, restaurantId: number, dto: UpdateBillDto): Promise<BillDto> {
    await assertBranch(branchId, restaurantId);
    const existing = await billRepository.findById(billId, branchId);
    if (!existing) throw new AppError('Bill not found', 404, 'NOT_FOUND');
    const updated = await billRepository.update(billId, {
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
      ...(dto.note !== undefined && { note: dto.note }),
    });
    return format(updated);
  },

  async markPaid(billId: number, branchId: number, restaurantId: number): Promise<BillDto> {
    await assertBranch(branchId, restaurantId);
    const existing = await billRepository.findById(billId, branchId);
    if (!existing) throw new AppError('Bill not found', 404, 'NOT_FOUND');
    if (existing.status === 'paid') throw new AppError('Bill is already paid', 409, 'ALREADY_PAID');
    const updated = await billRepository.markPaid(billId);
    return format(updated);
  },

  async softDelete(billId: number, branchId: number, restaurantId: number): Promise<void> {
    await assertBranch(branchId, restaurantId);
    const existing = await billRepository.findById(billId, branchId);
    if (!existing) throw new AppError('Bill not found', 404, 'NOT_FOUND');
    await billRepository.softDelete(billId);
  },
};
