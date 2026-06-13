import { AppError } from '../../middleware/errorHandler';
import { branchRepository } from '../branches/branches.repository';
import { sectionRepository } from './sections.repository';
import type { CreateSectionDto, UpdateSectionDto, SectionDto } from './sections.dto';

function formatSection(s: {
  id: number;
  branchId: number;
  name: string;
  sortOrder: number;
  createdAt: Date;
}): SectionDto {
  return {
    id: s.id,
    branchId: s.branchId,
    name: s.name,
    sortOrder: s.sortOrder,
    createdAt: s.createdAt,
  };
}

async function assertBranchExists(branchId: number, restaurantId: number) {
  const branch = await branchRepository.findById(branchId, restaurantId);
  if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');
}

async function assertSectionExists(sectionId: number, branchId: number) {
  const section = await sectionRepository.findById(sectionId, branchId);
  if (!section) throw new AppError('Section not found', 404, 'NOT_FOUND');
  return section;
}

export const sectionService = {
  async list(branchId: number, restaurantId: number): Promise<SectionDto[]> {
    await assertBranchExists(branchId, restaurantId);
    const sections = await sectionRepository.findAll(branchId);
    return sections.map(formatSection);
  },

  async create(
    branchId: number,
    restaurantId: number,
    dto: CreateSectionDto,
  ): Promise<SectionDto> {
    await assertBranchExists(branchId, restaurantId);
    const section = await sectionRepository.create({ branchId, ...dto });
    return formatSection(section);
  },

  async update(
    sectionId: number,
    branchId: number,
    restaurantId: number,
    dto: UpdateSectionDto,
  ): Promise<SectionDto> {
    await assertBranchExists(branchId, restaurantId);
    await assertSectionExists(sectionId, branchId);
    const updated = await sectionRepository.update(sectionId, dto);
    return formatSection(updated);
  },

  async softDelete(
    sectionId: number,
    branchId: number,
    restaurantId: number,
  ): Promise<void> {
    await assertBranchExists(branchId, restaurantId);
    await assertSectionExists(sectionId, branchId);

    const hasTables = await sectionRepository.hasActiveTables(sectionId);
    if (hasTables) {
      throw new AppError(
        'Cannot delete section: it still has active tables. Remove or reassign tables first.',
        409,
        'SECTION_HAS_TABLES',
      );
    }

    await sectionRepository.softDelete(sectionId);
  },
};
