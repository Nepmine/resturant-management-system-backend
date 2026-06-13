import prisma from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { signMemberToken } from '../../utils/jwt';
import type { QrScanDto, QrScanResponseDto } from './qr.dto';

export const qrService = {
  /**
   * POST /customer/qr/scan — Public
   *
   * Atomic transaction (§E1 / §F1):
   *  1. Lock table row via SELECT ... FOR UPDATE
   *  2. If table has no active session → CREATE dining_session + SET table.status = 'occupied'
   *     If active session exists → JOIN it (add new session_member row)
   *  3. Create session_member
   *  4. Issue member JWT
   *
   * The partial unique index on dining_sessions(table_id) WHERE status='active'
   * is the DB-level backstop. The FOR UPDATE lock here prevents the race at the
   * application level — only one transaction proceeds to INSERT at a time.
   *
   * §B2.8: Sessions are created ONLY via QR scan — never by staff directly.
   * §B2.6: table.status available→occupied is set ONLY here, inside this transaction.
   */
  async scan(dto: QrScanDto): Promise<QrScanResponseDto> {
    return prisma.$transaction(async (tx) => {
      // ── Step 1: Lock the table row ─────────────────────────────────────
      const tables = await tx.$queryRaw<
        Array<{
          id: number;
          branch_id: number;
          section_id: number;
          table_number: number;
          label: string | null;
          status: string;
          deleted_at: Date | null;
        }>
      >`
        SELECT id, branch_id, section_id, table_number, label, status, deleted_at
        FROM tables
        WHERE qr_token = ${dto.qrToken}
        LIMIT 1
        FOR UPDATE
      `;

      const table = tables[0];
      if (!table || table.deleted_at !== null) {
        throw new AppError('Invalid or expired QR code', 404, 'QR_NOT_FOUND');
      }

      // ── Step 2: Resolve branch + section for JWT payload ──────────────
      const branch = await tx.branch.findFirst({
        where: { id: table.branch_id, deletedAt: null, isActive: true },
        include: { restaurant: { select: { id: true } } },
      });
      if (!branch) {
        throw new AppError('Branch is not available', 403, 'BRANCH_UNAVAILABLE');
      }

      // Verify active subscription
      const subscriptions = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM subscriptions
        WHERE restaurant_id = ${branch.restaurant.id}
          AND (
            status = 'active'
            OR (status = 'grace_period' AND grace_expires_at > now())
          )
        LIMIT 1
      `;
      if (!subscriptions[0]) {
        throw new AppError(
          'Restaurant subscription is not active',
          403,
          'SUBSCRIPTION_INACTIVE',
        );
      }

      const section = await tx.section.findFirst({
        where: { id: table.section_id, deletedAt: null },
        select: { name: true },
      });

      // ── Step 3: Find or create active session ─────────────────────────
      let session = await tx.diningSession.findFirst({
        where: { tableId: table.id, status: 'active' },
      });

      let isNew = false;

      if (!session) {
        // No active session — create one and mark table occupied
        // The partial unique index (status='active', table_id) is the DB backstop
        // if two transactions both get here simultaneously.
        session = await tx.diningSession.create({
          data: {
            tableId: table.id,
            branchId: table.branch_id,
            status: 'active',
            startedAt: new Date(),
          },
        });

        // available → occupied transition (§B2.6 — ONLY via QR scan)
        await tx.table.update({
          where: { id: table.id },
          data: { status: 'occupied' },
        });

        isNew = true;
      }

      // ── Step 4: Add member to session ─────────────────────────────────
      // Name is required when creating a new session; optional (defaults to "Guest") when joining
      const memberName = dto.name ?? (isNew ? 'Guest' : 'Guest');
      const member = await tx.sessionMember.create({
        data: {
          sessionId: session.id,
          name: memberName,
          phone: dto.phone ?? null,
          joinedAt: new Date(),
        },
      });

      // ── Step 5: Issue member JWT ───────────────────────────────────────
      const memberToken = signMemberToken({
        sub: member.id,
        sessionId: session.id,
        tableId: table.id,
        branchId: table.branch_id,
        restaurantId: branch.restaurant.id,
      });

      return {
        memberToken,
        session: {
          id: session.id,
          status: session.status,
          tableId: table.id,
          tableNumber: table.table_number,
          tableLabel: table.label,
          sectionName: section?.name ?? '',
          branchId: table.branch_id,
          branchName: branch.name,
          isNew,
        },
        memberId: member.id,
        menuUrl: `${env.CUSTOMER_APP_URL}/menu`,
      };
    });
  },
};
