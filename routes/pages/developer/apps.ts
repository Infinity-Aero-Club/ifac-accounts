import express, { RequestHandler } from "express"
import { v4 as uuidv4 } from 'uuid';
import { createApplicationToken, deleteApplication, deleteApplicationToken, getAllApplicationIds, getApplicationDetails, getApplicationIdFromShtName, getApplicationNameFromId, updateApplication, verifyApplicationExists } from "../../../src/application";
import { createScope, deleteScope } from "../../../src/scope";
import { requireLoggedInMiddleware } from "../../../src/webtoken";

const router = express.Router();

router.get('/', requireLoggedInMiddleware, async function (req, res, next) {
    const apps = []
    for (const appId of await getAllApplicationIds()) {
        apps.push({
            id: appId,
            name: await getApplicationNameFromId(appId)
        })
    }
    res.render('developer/apps', { title: 'Apps', page: "apps", apps: apps });
})

router.get('/:id', requireLoggedInMiddleware, async function (req, res, next) {
    if (!(await verifyApplicationExists(req.params.id))) {
        return next()
    }

    const app = await getApplicationDetails(req.params.id)
    res.render('developer/app', { title: 'App', page: "apps", app })
})

router.post('/:id', requireLoggedInMiddleware, async function (req, res, next) {
    if (!(await verifyApplicationExists(req.params.id))) {
        return next()
    }
    if (req.body.action !== "delete-token") {
        return next()
    }

    await deleteApplicationToken(req.params.id, req.body.token)
    const app = await getApplicationDetails(req.params.id)
    res.render('developer/app', { title: 'App', page: "apps", app, message: "Token has been deleted" })
})

router.post('/:id', requireLoggedInMiddleware, async function (req, res, next) {
    if (!(await verifyApplicationExists(req.params.id))) {
        return next()
    }
    if (req.body.action !== "new-token") {
        return next()
    }

    const token = await createApplicationToken(req.params.id, req.body["token-name"])
    const app = await getApplicationDetails(req.params.id)
    res.render('developer/app', { title: 'App', page: "apps", app, message: `New Token: ${token}` })
})

router.get('/:id/edit/scopes', requireLoggedInMiddleware, async function (req, res, next) {
    if (!(await verifyApplicationExists(req.params.id))) {
        return next()
    }

    const app = await getApplicationDetails(req.params.id)
    res.render('developer/edit_app_scopes', { title: 'App', page: "apps", app })
})

router.post('/:id/edit/scopes', requireLoggedInMiddleware, async function (req, res, next) {
    if (!(await verifyApplicationExists(req.params.id))) {
        return next()
    }
    if (req.body.action !== "delete-scope") {
        return next()
    }

    await deleteScope(req.params.id, req.body.scope)
    const app = await getApplicationDetails(req.params.id)
    res.render('developer/edit_app_scopes', { title: 'App', page: "apps", app, message: "Scope has been deleted" })
})

router.post('/:id/edit/scopes', requireLoggedInMiddleware, async function (req, res, next) {
    if (!(await verifyApplicationExists(req.params.id))) {
        return next()
    }
    if (req.body.action !== "new-scope") {
        return next()
    }
    if (!/^[a-z0-9\-]+$/.test(req.body["scope-name"])) {
        const app = await getApplicationDetails(req.params.id)
        return res.render('developer/edit_app_scopes', { title: 'App', page: "apps", app, error: "Scope names must only contain lowercase alphanumeric characters" })
    }

    await createScope(req.params.id, req.body["scope-name"], req.body["pin-allowed"] === "on", req.body["extended-login-allowed"] === "on")
    const app = await getApplicationDetails(req.params.id)
    res.render('developer/edit_app_scopes', { title: 'App', page: "apps", app, message: `Scope created` })
})

router.get('/:id/edit', requireLoggedInMiddleware, async function (req, res, next) {
    if (!(await verifyApplicationExists(req.params.id))) {
        return next()
    }

    const app = res.locals.app || await getApplicationDetails(req.params.id)
    res.render('developer/new_or_edit_app', { title: 'EditApp', isNew: false, page: "apps", app, error: res.locals.error })
})

router.get('/new', requireLoggedInMiddleware, async function (req, res, next) {
    res.render('developer/new_or_edit_app', { title: 'New App', isNew: true, page: "apps", error: res.locals.error })
})

const newOrEditAppProcessor: RequestHandler = async (req, res, next) => {
    if (req.body.action !== "edit") {
        return next()
    }
    const name = req.body["name"]
    const shtName = req.body["sht_name"]
    const redirectUrls = req.body["redirect_urls"]
    res.locals.app = {
        name,
        shtName,
        redirectUrls: redirectUrls.split(/\r?\n/)
    }

    const shtNameAssignedTo = await getApplicationIdFromShtName(shtName)
    if (shtNameAssignedTo != null && shtNameAssignedTo !== req.params.id) {
        res.locals.error = "Short name already taken"
        req.method = 'GET';
        (router as any)["handle"](req, res, next)
        return
    }

    if (!/^[a-z0-9\-]+$/.test(shtName)) {
        res.locals.error = "Short name must only contain lowercase alphanumeric characters"
        req.method = 'GET';
        (router as any)["handle"](req, res, next)
        return
    }

    next()
}

router.post('/:id/edit', requireLoggedInMiddleware, async function (req, res, next) {
    if (!(await verifyApplicationExists(req.params.id))) {
        return next()
    }
    if (req.body.action !== "delete") {
        return next()
    }

    await deleteApplication(req.params.id)
    res.redirect(`/developer/apps`)
})

router.post('/:id/edit', requireLoggedInMiddleware, newOrEditAppProcessor, async function (req, res, next) {
    if (!(await verifyApplicationExists(req.params.id))) {
        return next()
    }
    if (req.body.action !== "edit") {
        return next()
    }

    await updateApplication(req.params.id, res.locals.app.name, res.locals.app.shtName, res.locals.app.redirectUrls)
    res.redirect(`/developer/apps/${req.params.id}`)
})

router.post('/new', requireLoggedInMiddleware, newOrEditAppProcessor, async function (req, res, next) {
    const id = uuidv4()
    await updateApplication(id, res.locals.app.name, res.locals.app.shtName, res.locals.app.redirectUrls)
    res.redirect(`/developer/apps/${id}`)
})

export default router
