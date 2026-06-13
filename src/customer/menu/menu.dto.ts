export interface CustomerOptionDto {
  id: number;
  name: string;
  priceModifier: number;
  sortOrder: number;
}

export interface CustomerOptionGroupDto {
  id: number;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: CustomerOptionDto[];
}

export interface CustomerMenuItemDto {
  id: number;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  isAvailable: boolean;
  disableNote: string | null;
  sortOrder: number;
  optionGroups: CustomerOptionGroupDto[];
}

export interface CustomerMenuCategoryDto {
  id: number;
  name: string;
  sortOrder: number;
  items: CustomerMenuItemDto[];
}

/** Full menu response — categories with nested items */
export type CustomerMenuDto = CustomerMenuCategoryDto[];
