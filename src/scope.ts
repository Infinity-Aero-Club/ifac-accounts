import { getAllApplicationIds, getApplicationIdFromShtName, getApplicationShtNameFromId, verifyApplicationExists } from "./application";
import { delAsync, existsAsync, getAsync, hexistsAsync, hgetAsync, hsetAsync, keysAsync, saddAsync, setAsync, sismemberAsync, smembersAsync, sremAsync } from "./rclient";
import { asyncFilter } from "./util";

export async function userHasScope(scope: string, userId: string, usedPin: boolean): Promise<boolean> {
    if (await hexistsAsync(`user:${userId}`, "terminated")) return false //Terminated users have no scopes

    if (scope.includes('.')) {
        const sd = await getScopeDetails(scope)
        if (sd == null) return false
        if (usedPin) {
            if (!sd.pinAllowed) return false
        }

        if ((await hgetAsync(`user:${userId}`, "admin")) === "true") return true //Admins have all scopes

        const isDisallowed = (await sismemberAsync(`user:${userId}:disallowedScopes`, scope)) === 1
        if (isDisallowed) return false

        const isAllowed = (await sismemberAsync(`user:${userId}:allowedScopes`, scope)) === 1
        if (isAllowed) return true

        const scopeGroupId = await hgetAsync(`user:${userId}`, "scopegroup")
        if (scopeGroupId != null) {
            const sgHasScope = (await sismemberAsync(`scopegroup:${scopeGroupId}`, scope)) === 1
            if (sgHasScope) return true
        }
        return false
    } else {
        if (scope === "admin") {
            const isAdmin = (await hgetAsync(`user:${userId}`, "admin")) === "true"
            if (isAdmin && !usedPin) {
                return true
            }
        } else if (scope === "openid") {
            if (!usedPin) {
                return true
            }
        }
    }
    return false
}

export interface ScopeDetails {
    pinAllowed: boolean
    extendedLoginAllowed: boolean
}

export async function getScopeDetails(scope: string): Promise<ScopeDetails | null> {
    if (scope.includes('.')) {
        const [appName, tag] = scope.split('.')
        const appId = await getApplicationIdFromShtName(appName)
        if (appId == null) return null
        if (!(await existsAsync(`application:${appId}:scope:${tag}`))) return null
        return {
            pinAllowed: (await hgetAsync(`application:${appId}:scope:${tag}`, "pinAllowed")) === "true",
            extendedLoginAllowed: (await hgetAsync(`application:${appId}:scope:${tag}`, "extendedLoginAllowed")) === "true"
        }
    } else {
        if (scope === "admin") {
            return {
                pinAllowed: false,
                extendedLoginAllowed: false
            }
        } else if (scope === "openid") {
            return {
                pinAllowed: false,
                extendedLoginAllowed: false
            }
        }
    }
    return null
}

export async function getScopesByApplicationId(appId: string): Promise<string[] | null> {
    if(!(await existsAsync(`application:${appId}`))) return null
    return await smembersAsync(`application:${appId}:scopes`)
}

export async function getAllScopes(): Promise<string[]> {
    const scopes = ["admin", "openid"]
    const applications = await getAllApplicationIds()
    for (const applicationId of applications) {
        const appName = (await getApplicationShtNameFromId(applicationId))!!
        const appScopes = (await getScopesByApplicationId(applicationId))!!
        appScopes.forEach((appScope) => scopes.push(`${appName}.${appScope}`))
    }
    return scopes
}

export async function getScopeGroupIds(): Promise<string[]> {
    return await smembersAsync(`scopegroups`)
}

export async function getScopeGroupNameFromId(scopeGroupId: string): Promise<string | null> {
    return await getAsync(`scopegroup:${scopeGroupId}:name`)
}

export async function getScopeGroupScopesFromId(scopeGroupId: string): Promise<string[]> {
    return asyncFilter(await getAllScopes(), async v => await checkScopeGroupHasScope(v, scopeGroupId))
}

export async function checkScopeGroupHasScope(scope: string, scopeGroupId: string): Promise<boolean> {
    return (await sismemberAsync(`scopegroup:${scopeGroupId}`, scope)) === 1
}

export async function verifyScopeGroupExists(scopeGroupId: string): Promise<boolean> {
    return await existsAsync(`scopegroup:${scopeGroupId}`) === 1
}

export interface ScopeGroupDetails {
    id: string
    name: string
    scopes: string[]
}

export async function getScopeGroupDetails(scopeGroupId: string): Promise<ScopeGroupDetails | null> {
    if (!(await verifyScopeGroupExists(scopeGroupId))) {
        return null
    }
    return {
        id: scopeGroupId,
        name: (await getScopeGroupNameFromId(scopeGroupId))!!,
        scopes: await getScopeGroupScopesFromId(scopeGroupId)
    }
}

export async function updateScopeGroup(scopeGroupId: string, name: string, scopes: string[]): Promise<void> {
    await setAsync(`scopegroup:${scopeGroupId}:name`, name)
    await delAsync(`scopegroup:${scopeGroupId}`)
    await saddAsync(`scopegroup:${scopeGroupId}`, ...scopes)
    await saddAsync(`scopegroups`, scopeGroupId)
}

export async function deleteScopeGroup(scopeGroupId: string): Promise<void> {
    const allSGKeys = await keysAsync(`scopegroup:${scopeGroupId}*`)
    for (const sgKey of allSGKeys) {
        await delAsync(sgKey)
    }
    await sremAsync(`scopegroups`, scopeGroupId)
}

export async function createScope(appId: string, name: string, pinAllowed: boolean, extendedLoginAllowed: boolean): Promise<void> {
    if (!(await verifyApplicationExists(appId))) {
        throw Error("Application does not exist")
    }
    if (!/^[a-z0-9\-]+$/.test(name)) {
        throw Error("Invalid scope name")
    }
    await saddAsync(`application:${appId}:scopes`, name)
    await hsetAsync(`application:${appId}:scope:${name}`, "pinAllowed", pinAllowed.toString())
    await hsetAsync(`application:${appId}:scope:${name}`, "extendedLoginAllowed", extendedLoginAllowed.toString())
}

export async function deleteScope(appId: string, name: string): Promise<void> {
    if (!(await verifyApplicationExists(appId))) {
        throw Error("Application does not exist")
    }
    await sremAsync(`application:${appId}:scopes`, name)
    await delAsync(`application:${appId}:scope:${name}`)
}
