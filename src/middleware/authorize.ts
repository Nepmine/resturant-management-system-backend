import { Request, Response, NextFunction } from 'express'

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    next()
  }
}
