import { RequestHandler } from "express"
import { getTokenClaims } from "../../src/session"

export const get_userinfo: RequestHandler = async (req, res, next) => {
    res.json(await getTokenClaims(res.locals["token"]))
}