import crypto from "crypto"
import { snowflake } from "../app"
import { selfUrl } from "./oauth";
import { delAsync, existsAsync, getAsync, hgetAsync, hsetAsync, keysAsync, saddAsync, setAsync, sismemberAsync, smembersAsync, sremAsync } from "./rclient";
import { getScopesByApplicationId, ScopeDetails, getScopeDetails } from "./scope"

export async function getAllApplicationIds(): Promise<string[]> {
    return await smembersAsync(`applications`)
}

export async function getApplicationNameFromId(appId: string): Promise<string | null> {
    return await hgetAsync(`application:${appId}`, "name")
}

export async function getApplicationShtNameFromId(appId: string): Promise<string | null> {
    return await hgetAsync(`application:${appId}`, "sht_name")
}

export async function verifyApplicationExists(appId: string): Promise<boolean> {
    return await existsAsync(`application:${appId}`) === 1
}

export async function getApplicationIdFromShtName(shtName: string): Promise<string | null> {
    const appId = await getAsync(`applicationname:${shtName}`)
    if (appId != null) return appId
    return null
}

export interface TokenDetails {
    id: string
    name: string
    createdAt: number
    hash: string
}

export interface ApplicationDetails {
    id: string
    name: string
    shtName: string
    scopes: {
        name: string
        details: ScopeDetails
    }[]
    redirectUrls: string[]
    tokens: TokenDetails[]
}

export async function getTokenIdsByApplicationId(appId: string): Promise<string[] | null> {
    if (!(await verifyApplicationExists(appId))) {
        return null
    }
    return await smembersAsync(`application:${appId}:tokens`)
}

export async function getApplicationTokenDetails(appId: string, tokenId: string): Promise<TokenDetails | null> {
    if (!(await verifyApplicationExists(appId)) || !(await existsAsync(`application:${appId}:token:${tokenId}`))) {
        return null
    }
    return {
        id: tokenId,
        name: await hgetAsync(`application:${appId}:token:${tokenId}`, "name"),
        createdAt: parseInt(await hgetAsync(`application:${appId}:token:${tokenId}`, "createdAt")),
        hash: await hgetAsync(`application:${appId}:token:${tokenId}`, "hash"),
    }
}

export async function createApplicationToken(appId: string, name: string): Promise<string> {
    if (!(await verifyApplicationExists(appId))) {
        throw Error("Application does not exist")
    }
    const id = snowflake.generate()
    const token = crypto.randomBytes(48).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    await saddAsync(`application:${appId}:tokens`, id)
    await saddAsync(`application:${appId}:tokenhashes`, tokenHash)
    await hsetAsync(`application:${appId}:token:${id}`, "name", name)
    await hsetAsync(`application:${appId}:token:${id}`, "createdAt", Math.round(Date.now()/1000).toString())
    await hsetAsync(`application:${appId}:token:${id}`, "hash", tokenHash)
    return token
}

export async function deleteApplicationToken(appId: string, tokenId: string): Promise<void> {
    if (!(await verifyApplicationExists(appId))) {
        throw Error("Application does not exist")
    }
    const details = await getApplicationTokenDetails(appId, tokenId)
    if (details == null) {
        throw Error("Token does not exist")
    }
    await sremAsync(`application:${appId}:tokens`, details.id)
    await sremAsync(`application:${appId}:tokenhashes`, details.hash)
    await delAsync(`application:${appId}:token:${details.id}`)
}

export async function verifyApplicationToken(appId: string, token: string): Promise<boolean> {
    if (!(await verifyApplicationExists(appId))) {
        throw Error("Application does not exist")
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    return await sismemberAsync(`application:${appId}:tokenhashes`, tokenHash) === 1
}

const alwaysAllowedUrls = [
    selfUrl + "/oauth/clientredirect"
]

export async function getRedirectUrlAllowed(appId: string, redirectUrl: string): Promise<boolean> {
    if (!(await verifyApplicationExists(appId))) {
        throw Error("Application does not exist")
    }

    if (alwaysAllowedUrls.includes(redirectUrl)) {
        return true
    }
    return (await sismemberAsync(`application:${appId}:redirecturls`, redirectUrl)) === 1
    
}

export async function getApplicationDetails(appId: string): Promise<ApplicationDetails | null> {
    if (!(await verifyApplicationExists(appId))) {
        return null
    }
    const shtName = (await getApplicationShtNameFromId(appId))!!
    const scopes = []
    for (const scopeName of (await getScopesByApplicationId(appId))!!) {
        scopes.push({
            name: scopeName,
            details: (await getScopeDetails(`${shtName}.${scopeName}`))!!
        })
    }

    const tokens = []
    for (const tokenId of (await getTokenIdsByApplicationId(appId))!!) {
        tokens.push((await getApplicationTokenDetails(appId, tokenId))!!)
    }

    const redirectUrls = await smembersAsync(`application:${appId}:redirecturls`)

    return {
        id: appId,
        name: (await getApplicationNameFromId(appId))!!,
        shtName,
        scopes: scopes,
        tokens,
        redirectUrls
    }
}

export async function updateApplication(appId: string, name: string, shtName: string, redirectUrls: string[]): Promise<void> {
    if (!/^[a-z0-9\-]+$/.test(shtName)) {
        throw Error("Invalid short name")
    }

    const originalShtName = await getApplicationShtNameFromId(appId)
    await delAsync(`applicationname:${originalShtName}`)

    await setAsync(`applicationname:${shtName}`, appId)
    await hsetAsync(`application:${appId}`, "name", name)
    await hsetAsync(`application:${appId}`, "sht_name", shtName)
    await delAsync(`application:${appId}:redirecturls`)
    for (const url of redirectUrls) {
        if (url.length > 0) {
            await saddAsync(`application:${appId}:redirecturls`, url)
        }
    }
    await saddAsync(`applications`, appId)
}

export async function deleteApplication(appId: string): Promise<void> {
    if (!(await verifyApplicationExists(appId))) {
        throw Error("Application does not exist")
    }

    const shtName = await getApplicationShtNameFromId(appId)
    await delAsync(`applicationname:${shtName}`)
    await sremAsync(`applications`, appId)
    const allAppKeys = await keysAsync(`application:${appId}*`)
    for (const appKey of allAppKeys) {
        await delAsync(appKey)
    }
}