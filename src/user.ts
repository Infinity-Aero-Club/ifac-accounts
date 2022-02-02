import { delAsync, existsAsync, getAsync, hgetAsync, hsetAsync, saddAsync, setAsync, smembersAsync, hdelAsync, keysAsync, sremAsync, hexistsAsync } from "./rclient"
import bcrypt from "bcrypt"
import { getAllScopes, getScopeGroupDetails, ScopeGroupDetails, userHasScope } from "./scope"
import { asyncFilter } from "./util"

export async function verifyUserExists(userId: string): Promise<boolean> {
    return await existsAsync(`user:${userId}`) === 1
}

export async function getUserNameFromId(userId: string): Promise<string | null> {
    return await hgetAsync(`user:${userId}`, "name")
}

export async function getUserFullNameFromId(userId: string): Promise<string | null> {
    return await hgetAsync(`user:${userId}`, "fullName")
}

export async function getUserIdFromName(userName: string): Promise<string | null> {
    return await getAsync(`username:${userName.toLowerCase()}`)
}

export async function getUserIdFromPin(pin: string): Promise<string | null> {
    return await getAsync(`pin:${pin}`)
}

export async function getPinFromUserId(userId: string): Promise<string | null> {
    return await hgetAsync(`user:${userId}`, "pin")
}

export async function getScopeGroupIdFromUserId(userId: string): Promise<string | null> {
    return await hgetAsync(`user:${userId}`, "scopegroup")
}

export async function getOnboardDateFromUserId(userId: string): Promise<string | null> {
    return await hgetAsync(`user:${userId}`, "onboardDate")
}

export interface UserFile {
    id: string,
    name: string
    url: string
    uploadTimestamp: number
}

export async function getUserFilesFromUserId(userId: string): Promise<UserFile[] | null> {
    if (!(await verifyUserExists(userId))) return null
    const fileIds = await smembersAsync(`user:${userId}:files`)
    const files: UserFile[] = []
    for (const fileId of fileIds) {
        files.push({
            id: fileId,
            name: await hgetAsync(`user:${userId}:file:${fileId}`, "name"),
            url: await hgetAsync(`user:${userId}:file:${fileId}`, "url"),
            uploadTimestamp: parseInt(await hgetAsync(`user:${userId}:file:${fileId}`, "uploadTimestamp"))
        })
    }
    return files
}

export interface UserNote {
    id: string
    name: string
    content: string
    timestamp: number
}

export async function getUserNotesFromUserId(userId: string): Promise<UserNote[] | null> {
    if (!(await verifyUserExists(userId))) return null
    const noteIds = await smembersAsync(`user:${userId}:notes`)
    const notes: UserNote[] = []
    for (const noteId of noteIds) {
        notes.push({
            id: noteId,
            name: await hgetAsync(`user:${userId}:note:${noteId}`, "name"),
            content: await hgetAsync(`user:${userId}:note:${noteId}`, "content"),
            timestamp: parseInt(await hgetAsync(`user:${userId}:note:${noteId}`, "timestamp"))
        })
    }
    return notes
}

export async function getUserIds(): Promise<string[]> {
    return await smembersAsync(`users`)
}

export async function getTerminatedUserIds(): Promise<string[]> {
    return await smembersAsync(`terminatedusers`)
}

export async function getUserIdFromLogin(username: string, password: string): Promise<string | null> {
    const userId = await getAsync(`username:${username.toLowerCase()}`)
    if (userId == null) {
        return null
    } else {
        const pwdHash = await hgetAsync(`user:${userId}`, "passwordHash")
        if (pwdHash == null) return null
        const valid = await bcrypt.compare(password, pwdHash)
        if (!valid) {
            return null
        } else {
            return userId
        }
    }
}

export async function getUserTerminatedFromId(userId: string): Promise<boolean> {
    return Boolean(await hexistsAsync(`user:${userId}`, "terminated"))
}

export async function getUserTerminatedAtFromId(userId: string): Promise<number> {
    return await parseInt(await hgetAsync(`user:${userId}`, "terminated"))
}

export interface UserDetails {
    id: string
    username: string
    fullName: string
    pin: string
    scopes: string[]
    terminated: boolean
    terminatedAt?: number
}

export async function getUserDetailsFromId(userId: string): Promise<UserDetails | null> {
    if (!(await verifyUserExists(userId))) return null
    return {
        id: userId,
        username: (await getUserNameFromId(userId))!!,
        fullName: (await getUserFullNameFromId(userId))!!,
        pin: (await getPinFromUserId(userId))!!,
        scopes: await asyncFilter((await getAllScopes()), async (scope) => await userHasScope(scope, userId, false)),
        terminated: await getUserTerminatedFromId(userId),
        terminatedAt: await getUserTerminatedAtFromId(userId)
    }
}

export interface FullUserDetails {
    id: string
    username: string
    fullName: string
    pin: string
    scopes: string[]
    terminated: boolean
    terminatedAt: number | null
    admin: boolean
    scopegroup: ScopeGroupDetails | null
    onboardDate: number
    files: UserFile[]
    notes: UserNote[]
    allowedScopes: string[]
    disallowedScopes: string[]
}

export async function getFullUserDetailsFromId(userId: string): Promise<FullUserDetails | null> {
    if (!(await verifyUserExists(userId))) return null

    const scopeGroupId = await getScopeGroupIdFromUserId(userId)
    return {
        ...(await getUserDetailsFromId(userId))!!,
        admin: await userHasScope("admin", userId, false),
        scopegroup: scopeGroupId != null ? await getScopeGroupDetails(scopeGroupId) : null,
        onboardDate: parseInt((await getOnboardDateFromUserId(userId))!!),
        files: ((await getUserFilesFromUserId(userId))!!).sort((a, b) => a.uploadTimestamp - b.uploadTimestamp),
        notes: ((await getUserNotesFromUserId(userId))!!).sort((a, b) => a.timestamp - b.timestamp),
        allowedScopes: (await getUserAllowedScopesFromId(userId))!!,
        disallowedScopes: (await getUserDisallowedScopesFromId(userId))!!,
        terminatedAt: null
    }
}

export async function getUserAllowedScopesFromId(userId: string): Promise<string[] | null> {
    return await smembersAsync(`user:${userId}:allowedScopes`)
}

export async function getUserDisallowedScopesFromId(userId: string): Promise<string[] | null> {
    return await smembersAsync(`user:${userId}:disallowedScopes`)
}

export async function updateUser(
    id: string,
    username: string,
    fullName: string,
    pin: string,
    admin: boolean,
    scopegroupId: string,
    onboardDate: number,
    allowedScopes: string[],
    disallowedScopes: string[]
): Promise<void> {
    const usernameAssignedTo = await getUserIdFromName(username)
    if (usernameAssignedTo != null && usernameAssignedTo !== id) throw Error("Duplicate Username")
    const pinAssignedTo = await getUserIdFromPin(pin)
    if (pinAssignedTo != null && pinAssignedTo !== id) throw Error("Duplicate Pin")

    const oldUsername = await getUserNameFromId(id)
    if (oldUsername != null) {
        await delAsync(`username:${oldUsername.toLowerCase()}`)
    }

    const oldPin = await getPinFromUserId(id)
    if (oldPin != null) {
        await delAsync(`pin:${oldPin}`)
    }

    await hsetAsync(`user:${id}`, "name", username)
    await hsetAsync(`user:${id}`, "fullName", fullName)
    await hsetAsync(`user:${id}`, "pin", pin)
    await hsetAsync(`user:${id}`, "admin", JSON.stringify(admin))
    if (scopegroupId.length > 0) { await hsetAsync(`user:${id}`, "scopegroup", scopegroupId) } else { await hdelAsync(`user:${id}`, "scopegroup") }
    await hsetAsync(`user:${id}`, "onboardDate", onboardDate.toString())

    await delAsync(`user:${id}:allowedScopes`)
    if (allowedScopes.length > 0) { await saddAsync(`user:${id}:allowedScopes`, ...allowedScopes) }
    await delAsync(`user:${id}:disallowedScopes`)
    if (disallowedScopes.length > 0) { await saddAsync(`user:${id}:disallowedScopes`, ...disallowedScopes) }

    await saddAsync(`users`, id)
    await setAsync(`username:${username.toLowerCase()}`, id)
    await setAsync(`pin:${pin}`, id)

}

export async function clearUserSessions(userId: string): Promise<void> {
    const allSessionKeys = await keysAsync(`session:*:user`)
    for (const sessionKey of allSessionKeys) {
        const sessionUserId = await getAsync(sessionKey)
        if (sessionUserId === userId) {
            await delAsync(sessionKey)
            await delAsync(sessionKey.replace("user", "scopes"))
        }
    }
}

export async function setUserPassword(userId: string, plaintextPassword: string): Promise<void> {
    const encPassword = await bcrypt.hash(plaintextPassword, 12)
    await hsetAsync(`user:${userId}`, "passwordHash", encPassword)
    clearUserSessions(userId)
}

export async function removeUserPassword(userId: string): Promise<void> {
    await hdelAsync(`user:${userId}`, "passwordHash")
    clearUserSessions(userId)
}

export async function terminateUser(userId: string): Promise<void> {
    await hsetAsync(`user:${userId}`, "terminated", Date.now().toString())
    await sremAsync(`users`, userId)
    await saddAsync(`terminatedusers`, userId)
    await delAsync(`username:${(await getUserNameFromId(userId))!!.toLowerCase()}`)
    await delAsync(`pin:${await getPinFromUserId(userId)}`)
    await hdelAsync(`user:${userId}`, "pin")
    await removeUserPassword(userId);
}

export async function reinstateUser(userId: string): Promise<void> {
    await hdelAsync(`user:${userId}`, "terminated")
    await saddAsync(`users`, userId)
    await sremAsync(`terminatedusers`, userId)
    await setAsync(`username:${(await getUserNameFromId(userId))!!.toLowerCase()}`, userId)
    await setAsync(`pin:${await getPinFromUserId(userId)}`, userId);
}

export async function deleteUser(userId: string): Promise<void> {
    await removeUserPassword(userId)
    await sremAsync(`terminatedusers`, userId)
    await sremAsync(`users`, userId)
    await delAsync(`username:${(await getUserNameFromId(userId))!!.toLowerCase()}`)
    await delAsync(`pin:${await getPinFromUserId(userId)}`)
    const allUserKeys = await keysAsync(`user:${userId}*`)
    for (const userKey of allUserKeys) {
        await delAsync(userKey)
    }
}