export type ApiErrorType = "invalid_request" | "invalid_token" | "insufficient_scope" | null

export class ApiError extends Error {
    constructor(message: string, errType: ApiErrorType) {
        super(message)
        this.name = this.constructor.name
        this.errType = errType
        Error.captureStackTrace(this, this.constructor)

        if (errType === "invalid_request") {
            this.statusCode = 400
        } else if (errType === "invalid_token") {
            this.statusCode = 401
        } else if (errType === "insufficient_scope") {
            this.statusCode = 403
        } else {
            this.statusCode = 401
        }
    }

    errType: ApiErrorType
    name: string
    statusCode: number
}