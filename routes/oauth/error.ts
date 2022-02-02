import { HttpError } from "http-errors"

export type OauthErrorType = "invalid_request" | "invalid_client" | "invalid_grant" | "invalid_scope" | "unauthorized_client" | "unsupported_grant_type"

export class OauthError extends Error {
  constructor(message: string, errType: OauthErrorType) {
    super(message)
    this.name = this.constructor.name
    this.errType = errType
    Error.captureStackTrace(this, this.constructor)

    if (errType === "invalid_client") {
      this.statusCode = 401
    } else {
      this.statusCode = 400
    }
  }

  errType: OauthErrorType
  name: string
  statusCode: number
}