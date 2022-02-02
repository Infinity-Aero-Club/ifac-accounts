import express from "express"
import { selfUrl } from "../../src/oauth"
import { exportJWK } from "jose"
import { publicKey } from "../../src/openid"
import { getAllScopes } from "../../src/scope"


const router = express.Router()

router.get('/openid-configuration', async function (req, res, next) {
    res.json({
        "issuer": selfUrl,
        "authorization_endpoint": selfUrl + "/oauth/authorize",
        "token_endpoint": selfUrl + "/oauth/token",
        "userinfo_endpoint": selfUrl + "/api/userinfo",
        "jwks_uri": selfUrl + "/.well-known/jwks.json",
        "scopes_supported": await getAllScopes(),
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"],
        
    })
})

router.get('/jwks.json', async function (req, res, next) {
    res.json({
        keys: [
            await exportJWK(publicKey)
        ]
    })
})

export default router