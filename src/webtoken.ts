import { RequestHandler } from "express"
import querystring from "querystring"
import { getTokenUser, verifyTokenHasScope } from "./session"
import { getUserFullNameFromId, getUserNameFromId } from "./user"

export function getWebTokenFromCookie(sessionCookie: string): string | null {
    if (sessionCookie.startsWith("User ")) {
        const token = sessionCookie.split(" ")[1]
        return token
    }
    return null
}

export async function validateWebAuthCookie(sessionCookie: string): Promise<string | null> { //Returns userId
    const token = getWebTokenFromCookie(sessionCookie)
    if (token == null) return null
    const hasAdmin = await verifyTokenHasScope(token, "admin")
    if (!hasAdmin) return null
    return await getTokenUser(token)
}

export const requireLoggedInMiddleware: RequestHandler = async (req, res, next) => {
    if ("session" in req.cookies) {
        const sessionCookie = req.cookies.session
        const userId = await validateWebAuthCookie(sessionCookie)
        if (userId != null) {
            res.locals["userId"] = userId
            res.locals["userName"] = await getUserNameFromId(userId)
            res.locals["userFullName"] = await getUserFullNameFromId(userId)
            next()
            return
        }
    }
    res.redirect(`/login?${querystring.stringify({ "redirect-to": req.originalUrl })}`)
}