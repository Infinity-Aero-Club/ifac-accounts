import crypto from "crypto"
import rclient, { sismemberAsync, getAsync, smembersAsync, saddAsync, setexAsync, delAsync, keysAsync } from "./rclient"
import { getScopeDetails, userHasScope } from "./scope"
import { asyncFilter } from "./util"

export const LackingScopeError = new Error("User does not have scope")
export const ScopeNoExistError = new Error("Scope does not exist")

const expirySeconds = 24 * 60 * 60
const extendedExpirySeconds = expirySeconds * 365

export async function createSessionToken(userId: string, requestedScopes: string[], usedPin: boolean, idClaims?: object | null): Promise<{ token: string, expiry: number }> {
    let extendedLogin = true
    for (const scope of requestedScopes) {
        const hasScope = await userHasScope(scope, userId, usedPin)
        if (!hasScope) {
            throw LackingScopeError
        }
        const sd = await getScopeDetails(scope)
        if (sd == null) { throw ScopeNoExistError }
        if (!sd.extendedLoginAllowed) { extendedLogin = false }
    }

    const expiresIn = extendedLogin ? extendedExpirySeconds : expirySeconds

    const token = crypto.randomBytes(48).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    await setexAsync(`session:${tokenHash}:user`, expiresIn, userId)
    await saddAsync(`session:${tokenHash}:scopes`, ...requestedScopes)
    rclient.expire(`session:${tokenHash}:scopes`, expiresIn)
    if (idClaims != null) {
        await setexAsync(`session:${tokenHash}:idClaims`, expiresIn, JSON.stringify(idClaims))
    }

    return {
        token,
        expiry: expiresIn
    }
}

export async function verifyTokenHasScope(token: string, scope: string): Promise<boolean> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const user = await getTokenUser(token)
    if (user != null) {
        return ((await sismemberAsync(`session:${tokenHash}:scopes`, scope)) === 1) && (await userHasScope(scope, user, false))
    }
    return false
}

export async function getTokenUser(token: string): Promise<string | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    return await getAsync(`session:${tokenHash}:user`)
}

export async function getTokenClaims(token: string): Promise<object | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const strClaims = await getAsync(`session:${tokenHash}:idClaims`)
    if (strClaims == null) return null
    return JSON.parse(strClaims)
}

//CAUTION: Always prefer verifyTokenHasScope, because some scopes may be nested
export async function getTokenScopes(token: string): Promise<string[]> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const user = await getTokenUser(token)
    if (user != null) {
        return await asyncFilter(await smembersAsync(`session:${tokenHash}:scopes`), async scope => await userHasScope(scope, user, false))
    }
    return []
}

export async function revokeToken(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const allSessionKeys = await keysAsync(`session:${tokenHash}*`)
    for (const sessionKey of allSessionKeys) {
        await delAsync(sessionKey)
    }
}