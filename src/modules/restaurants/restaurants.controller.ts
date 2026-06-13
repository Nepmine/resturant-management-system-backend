import type { Request, Response } from 'express';
import { restaurantService } from './restaurants.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse';
import type { CreateRestaurantDto, UpdateRestaurantDto } from './restaurants.dto';

export const restaurantController = {
  async create(req: Request, res: Response) {
    const data = await restaurantService.create(req.body as CreateRestaurantDto);
    sendCreated(res, data);
  },

  async getById(req: Request, res: Response) {
    const data = await restaurantService.getById(Number(req.params.id));
    sendSuccess(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await restaurantService.update(
      Number(req.params.id),
      req.body as UpdateRestaurantDto,
    );
    sendSuccess(res, data);
  },

  async softDelete(req: Request, res: Response) {
    await restaurantService.softDelete(Number(req.params.id));
    sendNoContent(res);
  },
};
