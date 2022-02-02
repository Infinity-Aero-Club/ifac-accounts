import { userHasScope } from "./scope"
import crypto from "crypto"
import rclient, { hgetAsync, hsetAsync, saddAsync, setexAsync, sismemberAsync, sremAsync } from "./rclient"
import { getApplicationShtNameFromId, verifyApplicationToken } from "./application"
import { createSessionToken, LackingScopeError } from "./session"
import { getUserIdFromPin } from "./user"
import { asyncFilter } from "./util"
import { genIdToken } from "./openid"
import { OauthError } from "../routes/oauth/error"

export const selfUrl = process.env.SELF_URL!

if (selfUrl == null) {
    throw new Error("SELF_URL is not set")
}

export async function generateOauthCode(userId: string, appIds: string[], scopes: string[], usedPin: boolean, nonce: string | null): Promise<string> {
    for (const scope of scopes) {
        if (!(await userHasScope(scope, userId, usedPin))) {
            throw LackingScopeError
        }
    }

    const code = crypto.randomBytes(12).toString('hex')
    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    await hsetAsync(`oauthcode:${codeHash}`, "userId", userId)
    await hsetAsync(`oauthcode:${codeHash}`, "scopes", scopes.join(' '))
    await hsetAsync(`oauthcode:${codeHash}`, "usedPin", JSON.stringify(usedPin))
    if (nonce != null) {
        await hsetAsync(`oauthcode:${codeHash}`, "nonce", nonce)
    }
    rclient.expire(`oauthcode:${codeHash}`, 30)
    await saddAsync(`oauthcode:${codeHash}:appIds`, ...appIds)
    rclient.expire(`oauthcode:${codeHash}:appIds`, 30)
    return code
}

export type TokenDetails = { 
    scopes: string[], 
    accessToken: string,
    idToken: string | null,
    expiry: number,
    userId: string
}
export async function exchangeOauthCode(appId: string, code: string, appToken: string): Promise<TokenDetails> {
    if (code == null) {
        throw new OauthError("Invalid exchange", "invalid_grant")
    }
    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    if (!await sismemberAsync(`oauthcode:${codeHash}:appIds`, appId) ||
        !await verifyApplicationToken(appId, appToken)) {
        throw new OauthError("Invalid exchange", "invalid_grant")
    }

    const appShtName = await getApplicationShtNameFromId(appId)
    const scopes = (await hgetAsync(`oauthcode:${codeHash}`, "scopes")).split(' ').filter(scope => (scope.split('.').length === 1 || scope.split('.')[0] === appShtName))
    const userId = await hgetAsync(`oauthcode:${codeHash}`, "userId")
    const nonce = await hgetAsync(`oauthcode:${codeHash}`, "nonce")
    const [idToken, idClaims] = scopes.includes("openid") ? await genIdToken(userId, appId, scopes, nonce) : [null, null]

    const tokenDetails = await createSessionToken(userId, scopes, await hgetAsync(`oauthcode:${codeHash}`, "usedPin") === "true", idClaims)
    await sremAsync(`oauthcode:${codeHash}:appIds`, appId)

    return {
        scopes: scopes,
        accessToken: tokenDetails.token,
        idToken,
        expiry: tokenDetails.expiry,
        userId: userId,
    }
}

export async function exchangeOauthPin(appId: string, pin: string, appToken: string, scopes: string[]): Promise<{ scopes: string[], token: string, expiry: number }> {
    const userId = await getUserIdFromPin(pin)
    if (userId == null) {
        throw new OauthError("Invalid Pin", "invalid_grant")
    }
    const allowedScopes: string[] = await asyncFilter(scopes, async scope => await userHasScope(scope, userId, true))
    if (allowedScopes.length < 1) {
        throw new OauthError("Unauthorized", "invalid_request")
    }
    if (!await verifyApplicationToken(appId, appToken)) {
        throw new OauthError("Invalid exchange", "invalid_request")
    }

    const tokenDetails = await createSessionToken(userId, allowedScopes, true)

    return {
        scopes: allowedScopes,
        token: tokenDetails.token,
        expiry: tokenDetails.expiry
    }
}