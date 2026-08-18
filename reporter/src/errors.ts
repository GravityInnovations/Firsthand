export class AppError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string, readonly details?: unknown) { super(message); this.name = "AppError"; }
}
