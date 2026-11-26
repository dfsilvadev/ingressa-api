export class AppError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly details?: unknown
  public readonly expose: boolean

  constructor(
    message: string,
    status: number,
    code: string,
    details?: unknown,
    expose: boolean = true,
  ) {
    super(message)
    this.name = this.constructor.name
    this.status = status
    this.code = code
    this.details = details
    this.expose = expose
    Error.captureStackTrace(this, this.constructor)
  }
}
