import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export function signStaffJWT(payload: object) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' })
}

export function signMemberJWT(payload: object) {
  return jwt.sign(payload, env.JWT_MEMBER_SECRET, { expiresIn: '7d' })
}
