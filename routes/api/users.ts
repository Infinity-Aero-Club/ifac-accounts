import { RequestHandler } from "express"
import { verifyTokenHasScope } from "../../src/session"
import { getUserDetailsFromId, getUserIds } from "../../src/user"
import { ApiError } from "./error"

export const get_users: RequestHandler = async (req, res, next) => {
    const users = []
    const userIds = await getUserIds()
    for (const userId of userIds) {
        const userDetails = (await getUserDetailsFromId(userId))!
        userDetails.scopes = userDetails.scopes.filter(v => v.startsWith(res.locals["appName"]))
        users.push(userDetails)
    }
    res.json(users)
}

export const get_user: RequestHandler = async (req, res, next) => {
    const userDetails = await getUserDetailsFromId(req.params.id)
    if (userDetails != null) {
        userDetails.scopes = userDetails.scopes.filter(v => v.startsWith(res.locals["appName"]))
    }
    res.status(userDetails == null ? 404 : 200).json(userDetails)
}

export const get_me: RequestHandler = async (req, res, next) => {
    const userDetails = await getUserDetailsFromId(res.locals["userId"])
    res.status(userDetails == null ? 404 : 200).json(userDetails)
}

export const get_me_hasscope: RequestHandler = async (req, res, next) => {
    if (!("scope" in req.query)) throw new ApiError("No scope supplied", "invalid_request")
    const scope = req.query.scope as string
    res.json(await verifyTokenHasScope(res.locals.token, scope))
}