import { RequestHandler } from "express"
import { getTokenScopes, getTokenUser, revokeToken, verifyTokenHasScope } from "../../src/session"
import { getUserFullNameFromId, getUserNameFromId } from "../../src/user"
import { ApiError } from "./error"

export const get_tokeninfo: RequestHandler = async (req, res, next) => {
    if (!("userToken" in req.query)) throw new ApiError("No user token supplied", "invalid_request")
    const token = req.query.userToken as string
    const userId = await getTokenUser(token)
    if (userId == null) throw new ApiError("Invalid User Token", "invalid_request")
    res.json({
        user: {
            id: userId,
            username: await getUserNameFromId(userId),
            fullName: await getUserFullNameFromId(userId),
            scopes: (await getTokenScopes(token)).filter((scope) => scope.startsWith(res.locals["appName"]) || !scope.includes('.'))
            /* NOTE: Use the above only for reference. Use GET /api/tokeninfo/scope to see if a token has a scope, as some scopes may be nested */
        }
    })
}

export const get_tokeninfo_scope: RequestHandler = async (req, res, next) => {
    if (!("userToken" in req.query)) throw new ApiError("No user token supplied", "invalid_request")
    const token = req.query.userToken as string
    if (!("scope" in req.query)) throw new ApiError("No scope supplied", "invalid_request")
    const scope = req.query.scope as string
    const userId = await getTokenUser(token)
    if (userId == null) throw new ApiError("Invalid User Token", "invalid_request")
    res.json(await verifyTokenHasScope(token, scope))
}

export const post_tokeninfo_revoke: RequestHandler = async (req, res, next) => {
    if (!("userToken" in req.body)) throw new ApiError("No user token supplied", "invalid_request")
    const token = req.body.userToken as string
    revokeToken(token)
    res.status(200).json(true)
}