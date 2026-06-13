import { z } from 'zod';
import {
  createRestaurantSchema,
  updateRestaurantSchema,
} from './restaurants.schema';

export type CreateRestaurantDto = z.infer<typeof createRestaurantSchema>['body'];
export type UpdateRestaurantDto = z.infer<typeof updateRestaurantSchema>['body'];

export interface RestaurantDto {
  id: number;
  name: string;
  address: string | null;
  billingEmail: string | null;
  createdAt: Date;
  subscription?: {
    plan: string;
    status: string;
    expiresAt: Date | null;
    graceExpiresAt: Date | null;
  };
}
