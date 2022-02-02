import fs from "fs"
import path from "path"
import { generateKeyPair, JWTPayload, jwtVerify, SignJWT, KeyLike, exportPKCS8, importPKCS8, exportSPKI, importSPKI } from "jose"
import { selfUrl } from "./oauth"
import { getUserDetailsFromId } from "./user"

export let publicKey: KeyLike
export let privateKey: KeyLike;

(async () => {
    if (fs.existsSync(path.join('keys', 'private.pem')) && fs.existsSync(path.join('keys', 'public.pem'))) {
        publicKey = await importSPKI(fs.readFileSync(path.join('keys', 'public.pem')).toString(), "RS256")
        privateKey = await importPKCS8(fs.readFileSync(path.join('keys', 'private.pem')).toString(), "RS256")
    } else {
        const { publicKey: pub, privateKey: priv } = await generateKeyPair("RS256")
        publicKey = pub
        privateKey = priv
        fs.writeFileSync(path.join('keys', 'private.pem'), await exportPKCS8(privateKey))
        fs.writeFileSync(path.join('keys', 'public.pem'), await exportSPKI(publicKey))
    }
})()

export async function genIdToken(userId: string, clientId: string, scopes: string[], nonce: string | null): Promise<[string, JWTPayload]> {
    const user = await getUserDetailsFromId(userId)
    if (user == null) {
        throw Error("User does not exist")
    }
    const token = await new SignJWT({
        scopes,
        name: user.fullName,
        "preferred_username": user.username,
        nonce: nonce ?? undefined,
    })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuedAt()
        .setIssuer(selfUrl)
        .setAudience(clientId)
        .setSubject(userId)
        .setExpirationTime('1d')
        .sign(privateKey)

    return [token, (await jwtVerify(token, publicKey)).payload]
}