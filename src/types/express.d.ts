declare namespace Express {
  interface Request {
    user?: Record<string, unknown>
    tenant?: Record<string, unknown>
    member?: Record<string, unknown>
  }
}
