import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { branchRepository } from '../branches/branches.repository';
import { sectionRepository } from '../sections/sections.repository';
import { tableRepository } from './tables.repository';
import { generateQrToken, renderQrSvg } from './tables.qr';
import type { CreateTableDto, UpdateTableDto, TableDto, QrDataDto } from './tables.dto';
import type { TableStatus } from '@prisma/client';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTable(t: {
  id: number;
  branchId: number;
  sectionId: number;
  tableNumber: number;
  label: string | null;
  status: string;
  qrToken: string;
  createdAt: Date;
  section?: { id: number; name: string } | null;
}, includeToken = false): TableDto {
  return {
    id: t.id,
    branchId: t.branchId,
    sectionId: t.sectionId,
    tableNumber: t.tableNumber,
    label: t.label,
    status: t.status,
    ...(includeToken && { qrToken: t.qrToken }),
    createdAt: t.createdAt,
  };
}

async function assertBranchBelongsToRestaurant(
  branchId: number,
  restaurantId: number,
) {
  const branch = await branchRepository.findById(branchId, restaurantId);
  if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');
}

async function getTableOrThrow(tableId: number, branchId: number) {
  const table = await tableRepository.findByBranchAndId(tableId, branchId);
  if (!table) throw new AppError('Table not found', 404, 'NOT_FOUND');
  return table;
}

// ─── service ────────────────────────────────────────────────────────────────

export const tableService = {
  async list(
    branchId: number,
    restaurantId: number,
    filters: { sectionId?: number; status?: TableStatus },
  ): Promise<TableDto[]> {
    await assertBranchBelongsToRestaurant(branchId, restaurantId);
    const tables = await tableRepository.findAll(branchId, filters);
    return tables.map((t) => formatTable(t));
  },

  /**
   * Create table — auto-generates qr_token via crypto.randomBytes(32).
   * §B2.6: tableNumber must be unique within its section.
   */
  async create(
    branchId: number,
    restaurantId: number,
    dto: CreateTableDto,
  ): Promise<TableDto> {
    await assertBranchBelongsToRestaurant(branchId, restaurantId);

    // Validate section belongs to this branch
    const section = await sectionRepository.findById(dto.sectionId, branchId);
    if (!section) throw new AppError('Section not found', 404, 'NOT_FOUND');

    // Enforce unique tableNumber within section
    const duplicate = await tableRepository.existsWithTableNumber(
      dto.sectionId,
      dto.tableNumber,
    );
    if (duplicate) {
      throw new AppError(
        `Table number ${dto.tableNumber} already exists in this section`,
        409,
        'TABLE_NUMBER_CONFLICT',
      );
    }

    const qrToken = generateQrToken();
    const table = await tableRepository.create({
      branchId,
      sectionId: dto.sectionId,
      tableNumber: dto.tableNumber,
      label: dto.label,
      qrToken,
    });

    return formatTable(table);
  },

  /**
   * Update table_number / label only.
   * Status is NEVER updated here — use dedicated transition endpoints.
   */
  async update(
    tableId: number,
    branchId: number,
    restaurantId: number,
    dto: UpdateTableDto,
  ): Promise<TableDto> {
    await assertBranchBelongsToRestaurant(branchId, restaurantId);
    const existing = await getTableOrThrow(tableId, branchId);

    // If tableNumber changes, re-check uniqueness within same section
    if (dto.tableNumber !== undefined && dto.tableNumber !== existing.tableNumber) {
      const duplicate = await tableRepository.existsWithTableNumber(
        existing.sectionId,
        dto.tableNumber,
        tableId,
      );
      if (duplicate) {
        throw new AppError(
          `Table number ${dto.tableNumber} already exists in this section`,
          409,
          'TABLE_NUMBER_CONFLICT',
        );
      }
    }

    const updated = await tableRepository.update(tableId, dto);
    return formatTable(updated);
  },

  async softDelete(
    tableId: number,
    branchId: number,
    restaurantId: number,
  ): Promise<void> {
    await assertBranchBelongsToRestaurant(branchId, restaurantId);
    const existing = await getTableOrThrow(tableId, branchId);

    // Cannot delete a table that is currently occupied or being cleaned
    if (existing.status !== 'available') {
      throw new AppError(
        `Cannot delete table with status '${existing.status}'. It must be 'available' first.`,
        409,
        'TABLE_NOT_AVAILABLE',
      );
    }

    await tableRepository.softDelete(tableId);
  },

  // ─── QR endpoints ──────────────────────────────────────────────────────

  /**
   * GET /tables/:tableId/qr — Manager+
   * Returns current qr_token + rendered SVG.
   */
  async getQr(tableId: number, branchId: number, restaurantId: number): Promise<QrDataDto> {
    await assertBranchBelongsToRestaurant(branchId, restaurantId);
    const table = await getTableOrThrow(tableId, branchId);
    const svg = await renderQrSvg(table.qrToken);
    return {
      tableId: table.id,
      tableNumber: table.tableNumber,
      qrToken: table.qrToken,
      svg,
    };
  },

  /**
   * POST /tables/:tableId/regenerate-qr — Manager+
   * Issues a new qr_token, invalidating all existing printed QR codes for this table.
   * §B2.6: QR token is NEVER updated via generic PATCH — only via this dedicated endpoint.
   */
  async regenerateQr(
    tableId: number,
    branchId: number,
    restaurantId: number,
  ): Promise<QrDataDto> {
    await assertBranchBelongsToRestaurant(branchId, restaurantId);
    const existing = await getTableOrThrow(tableId, branchId);

    const newToken = generateQrToken();
    await tableRepository.updateQrToken(existing.id, newToken);
    const svg = await renderQrSvg(newToken);

    return {
      tableId: existing.id,
      tableNumber: existing.tableNumber,
      qrToken: newToken,
      svg,
    };
  },

  // ─── Status transition endpoints ──────────────────────────────────────
  //
  // Lifecycle: available → occupied (QR scan — NOT via staff endpoints)
  //            occupied  → cleaning  (POST /tables/:id/cleaning)
  //            cleaning  → available (POST /tables/:id/available)
  //
  // §B2.6: Table status transitions are enforced via dedicated endpoints only.
  // Generic PATCH MUST NOT touch status.

  /**
   * POST /tables/:tableId/cleaning — Staff+
   * Transition: occupied → cleaning.
   * Called when staff closes a session.
   */
  async markCleaning(
    tableId: number,
    branchId: number,
    restaurantId: number,
  ): Promise<TableDto> {
    await assertBranchBelongsToRestaurant(branchId, restaurantId);
    const table = await getTableOrThrow(tableId, branchId);

    if (table.status !== 'occupied') {
      throw new AppError(
        `Table must be 'occupied' to mark as cleaning (current: '${table.status}')`,
        409,
        'INVALID_STATUS_TRANSITION',
      );
    }

    const updated = await tableRepository.updateStatus(tableId, 'cleaning');
    return formatTable(updated);
  },

  /**
   * POST /tables/:tableId/available — Staff+
   * Transition: cleaning → available.
   * Explicit staff action after cleaning is complete.
   */
  async markAvailable(
    tableId: number,
    branchId: number,
    restaurantId: number,
  ): Promise<TableDto> {
    await assertBranchBelongsToRestaurant(branchId, restaurantId);
    const table = await getTableOrThrow(tableId, branchId);

    if (table.status !== 'cleaning') {
      throw new AppError(
        `Table must be 'cleaning' to mark as available (current: '${table.status}')`,
        409,
        'INVALID_STATUS_TRANSITION',
      );
    }

    const updated = await tableRepository.updateStatus(tableId, 'available');
    return formatTable(updated);
  },

  /**
   * Internal-only: transition available → occupied.
   * Called exclusively by the QR scan service — never exposed as a staff endpoint.
   * Runs inside the caller's transaction so the table lock is held across
   * session creation (prevents two simultaneous scans both thinking the table is free).
   */
  async markOccupiedInternal(
    tableId: number,
    tx: Parameters<typeof tableRepository.updateStatus>[2],
  ) {
    return tableRepository.updateStatus(tableId, 'occupied', tx);
  },
};
