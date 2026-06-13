import { Request, Response, NextFunction } from 'express'

export function tenant(req: Request, res: Response, next: NextFunction) {
  next()
}
