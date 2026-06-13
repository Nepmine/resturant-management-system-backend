import { Request, Response, NextFunction } from 'express'

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  next()
}
