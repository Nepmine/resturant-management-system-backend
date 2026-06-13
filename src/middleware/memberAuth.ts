import { Request, Response, NextFunction } from 'express'

export function memberAuth(req: Request, res: Response, next: NextFunction) {
  next()
}
