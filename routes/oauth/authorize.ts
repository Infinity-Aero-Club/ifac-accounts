import express from "express"
import { ApplicationDetails, getApplicationDetails, getRedirectUrlAllowed, verifyApplicationExists } from "../../src/application"
import { generateOauthCode } from "../../src/oauth"
import { getScopeDetails, userHasScope } from "../../src/scope"
import { getUserIdFromLogin } from "../../src/user"
import { asyncFilter, asyncMap, hasDuplicates } from "../../src/util"
import { invalidLoginVars } from "../pages/login"

const router = express.Router()

router.use('/', async function (req, res, next) {
    const clientIds = (req.query["client_id"]?.toString())?.split(',')
    const state = req.query["state"]?.toString()
    const redirectUri = req.query["redirect_uri"]?.toString()
    const nonce = req.query["nonce"]?.toString()
    const scope = req.query["scope"]?.toString()
    const scopes = scope != null ? scope.split(' ') : []

    if (clientIds == null || clientIds.length === 0) {
        return res.render("error", { message: "OAUTH Error", title: "Error", error: { status: "Missing application" } })
    }

    if (redirectUri == null) {
        return res.render("error", { message: "OAUTH Error", title: "Error", error: { status: "Missing redirect uri" } })
    }

    if (hasDuplicates(clientIds)) {
        return res.render("error", { message: "OAUTH Error", title: "Error", error: { status: "Duplicate application" } })
    }

    for (const clientId of clientIds) {
        if (clientId == null || !(await verifyApplicationExists(clientId))) {
            return res.render("error", { message: "OAUTH Error", title: "Error", error: { status: "Invalid application" } })
        }
        if (!(await getRedirectUrlAllowed(clientId, redirectUri))) {
            return res.render("error", { message: "OAUTH Error", title: "Error", error: { status: "Invalid redirect uri" } })
        }
    }

    const appsDetails = await asyncMap(clientIds, async clientId => (await getApplicationDetails(clientId))!)
    const appShtNames = appsDetails.map(d => d.shtName)

    if (scopes.length < 1) {
        const url = new URL(redirectUri)
        url.searchParams.append("error", "invalid_scope")
        return res.redirect(url.toString())
    }
    for (const scope of scopes) {
        if (!appShtNames.includes(scope.split('.')[0]) && (await getScopeDetails(scope)) == null) {
            const url = new URL(redirectUri)
            url.searchParams.append("error", "invalid_scope")
            return res.redirect(url.toString())
        }
    }

    res.locals.clientIds = clientIds
    res.locals.state = state
    res.locals.redirectUri = redirectUri
    res.locals.nonce = nonce
    res.locals.scopes = scopes
    res.locals.apps = appsDetails
    next()
})

router.get('/', async function (req, res, next) {
    if (req.query["response_type"] !== "code") {
        return next()
    }

    res.render('login', { title: 'Login', description: `Login to ${new Intl.ListFormat().format((res.locals.apps as ApplicationDetails[]).map(app => app.name))}` })
})

router.post('/', async function (req, res, next) {
    if (req.query["response_type"] !== "code") {
        return next()
    }

    const username = req.body.username
    const password = req.body.password

    const userId = await getUserIdFromLogin(username, password)
    if (userId == null) {
        return res.render('login', { ...invalidLoginVars, description: `Login to ${new Intl.ListFormat().format((res.locals.apps as ApplicationDetails[]).map(app => app.name))}` })
    }

    const allowedScopes: string[] = await asyncFilter(res.locals.scopes, async scope => await userHasScope(scope, userId, false))

    if (allowedScopes.length < 1) {
        const url = new URL(res.locals.redirectUri)
        url.searchParams.append("error", "access_denied")
        return res.redirect(url.toString()) 
    }

    const url = new URL(res.locals.redirectUri)
    url.searchParams.append("code", await generateOauthCode(userId, res.locals.clientIds, allowedScopes, false, res.locals.nonce))
    url.searchParams.append("scope", allowedScopes.join(' '))
    if (res.locals.state != null) {
        url.searchParams.append("state", res.locals.state)
    }
    return res.redirect(url.toString()) 

})

router.use('/', async function (req, res, next) {
    const url = new URL(res.locals.redirectUri)
    url.searchParams.append("error", "unsupported_response_type")
    res.redirect(url.toString())
})

export default router