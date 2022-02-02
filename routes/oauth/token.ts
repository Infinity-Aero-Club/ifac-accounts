import express from "express"
import { exchangeOauthCode, exchangeOauthPin } from "../../src/oauth"
import { OauthError } from "./error"


const router = express.Router()

router.post('/', async function (req, res, next) {

    let clientId: string | null = null
    let clientSecret: string | null = null

    if (req.headers.authorization != null) {
        const [type, data] = req.headers.authorization.split(' ')
        if (type === "Basic") {
            const [login, password] = Buffer.from(data, 'base64').toString().split(':')
            clientId = login
            clientSecret = password
        } else if (type === "Application") {
            if (data.includes(':')) {
                const [appId, token] = data.split(':')
                clientId = appId
                clientSecret = token
            }
        }
    } else {
        clientId = req.body["client_id"]
        clientSecret = req.body["client_secret"]
    }

    if (clientId == null || clientSecret == null) {
        throw Error("Invalid client credentials")
    }

    res.locals.clientId = clientId
    res.locals.clientSecret = clientSecret

    return next()
})

router.post('/', async function (req, res, next) {
    if (req.body["grant_type"] !== "authorization_code") {
        return next()
    }

    const code = req.body["code"]
    const clientId = res.locals.clientId
    const clientSecret = res.locals.clientSecret

    const tokenDetails = await exchangeOauthCode(clientId, code, clientSecret)

    return res.json({
        access_token: tokenDetails.accessToken,
        token_type: "Bearer",
        scope: tokenDetails.scopes.join(' '),
        expires_in: tokenDetails.expiry,
        id_token: tokenDetails.idToken ?? undefined
    })
})

router.post('/', async function (req, res, next) {
    if (req.body["grant_type"] !== "pin") {
        return next()
    }

    const pin = req.body["pin"]
    const clientId = res.locals.clientId
    const clientSecret = res.locals.clientSecret
    const scope = req.body["scope"]
    const scopes = scope != null ? scope.split(' ') : []

    const tokenDetails = await exchangeOauthPin(clientId, pin, clientSecret, scopes)
    return res.json({
        access_token: tokenDetails.token,
        token_type: "Bearer",
        scope: tokenDetails.scopes.join(' '),
        expires_in: tokenDetails.expiry
    })
})

router.use(function (req, res, next) {
    throw new OauthError("Invalid grant type", "unsupported_grant_type")
})

export default router
