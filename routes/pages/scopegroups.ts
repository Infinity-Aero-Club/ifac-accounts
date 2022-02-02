import express, { RequestHandler } from "express"
import { snowflake } from "../../app"
import { getAllApplicationIds, getApplicationNameFromId, getApplicationShtNameFromId } from "../../src/application"
import { getScopeGroupIds, getScopeGroupNameFromId, verifyScopeGroupExists, getScopeGroupDetails, ScopeGroupDetails, updateScopeGroup, deleteScopeGroup, getScopesByApplicationId } from "../../src/scope"
import { getScopeGroupIdFromUserId, getUserDetailsFromId, getUserFullNameFromId, getUserIds } from "../../src/user"
import { requireLoggedInMiddleware } from "../../src/webtoken"
const router = express.Router()

router.get('/', requireLoggedInMiddleware, async function (req, res, next) {
  const groups = []
  const groupIds = await getScopeGroupIds()
  for (const groupId of groupIds) {
    groups.push({
      id: groupId,
      name: await getScopeGroupNameFromId(groupId)
    })
  }
  res.render('scopegroups/scopegroups', { title: 'Roles', page: "roles", scopegroups: groups })
})

router.get('/:id', requireLoggedInMiddleware, async function (req, res, next) {
  if (!(await verifyScopeGroupExists(req.params.id))) {
    next()
    return
  }
  const group = (await getScopeGroupDetails(req.params.id))!
  const users = []
  const userIds = await getUserIds()
  for (const userId of userIds) {
    if (await getScopeGroupIdFromUserId(userId) === group.id) {
      users.push({
        id: userId,
        name: await getUserFullNameFromId(userId)
      })
    }
  }

  const appScopes = []
  const applications = await getAllApplicationIds()
  for (const applicationId of applications) {
    appScopes.push({
      shtName: await getApplicationShtNameFromId(applicationId),
      name: await getApplicationNameFromId(applicationId),
      scopes: await getScopesByApplicationId(applicationId)
    })
  }
  res.render('scopegroups/scopegroup', { title: 'Roles', page: "roles", scopegroup: group, users, appScopes })
})

const newOrEditScopegroupPreparer: RequestHandler = async (req, res, next) => {
  const group = await getScopeGroupDetails(req.params.id)
  res.locals.group = group
  const appScopes = []
  const applications = await getAllApplicationIds()
  for (const applicationId of applications) {
    appScopes.push({
      shtName: await getApplicationShtNameFromId(applicationId),
      name: await getApplicationNameFromId(applicationId),
      scopes: await getScopesByApplicationId(applicationId)
    })
  }
  res.locals.appScopes = appScopes

  next()
}

router.get('/:id/edit', requireLoggedInMiddleware, newOrEditScopegroupPreparer, async function (req, res, next) {
  if (!(await verifyScopeGroupExists(req.params.id))) {
    next()
    return
  }

  const scopegroup = await getScopeGroupDetails(req.params.id)
  res.render('scopegroups/new_or_edit_scopegroup', { title: 'Roles', page: "roles", isNew: false, appScopes: res.locals.appScopes, error: res.locals.error, scopegroup: res.locals.scopegroup || scopegroup })
})

router.get('/new', requireLoggedInMiddleware, newOrEditScopegroupPreparer, async function (req, res, next) {
  res.render('scopegroups/new_or_edit_scopegroup', { title: 'Roles', page: "roles", isNew: true, appScopes: res.locals.appScopes, error: res.locals.error, scopegroup: res.locals.scopegroup })
})

const newOrEditScopegroupProcessor: RequestHandler = async (req, res, next) => {
  if (req.body.action !== "edit") {
    return next()
  }
  const name = req.body["name"]

  const scopes = []
  for (const scopeParam of Object.keys(req.body).filter((v) => v.startsWith("scope-"))) {
    const scope = scopeParam.replace("scope-", "")
    const value = req.body[scopeParam]
    if (value === "grant") {
      scopes.push(scope)
    }
  }

  const scopegroup = {
    id: null,
    name,
    scopes
  }
  res.locals.scopegroup = scopegroup

  if (!name || name.length === 0) {
    res.locals.error = "Please fill out all fields"
    req.method = 'GET';
    (router as any)["handle"](req, res, next)
    return
  }

  if (scopes.length < 1) {
    res.locals.error = "Roles must have at least one granted scope"
    req.method = 'GET';
    (router as any)["handle"](req, res, next)
    return
  }

  next()
}

router.post('/:id/edit', requireLoggedInMiddleware, newOrEditScopegroupProcessor, async function (req, res, next) {
  if (!(await verifyScopeGroupExists(req.params.id))) {
    next()
    return
  }

  if (req.body.action === "edit") {
    await updateScopeGroup(req.params.id, res.locals.scopegroup.name, res.locals.scopegroup.scopes)
    res.redirect(`/roles/${req.params.id}`)
  } else {
    next()
  }
})

router.post('/:id/edit', requireLoggedInMiddleware, newOrEditScopegroupProcessor, async function (req, res, next) {
  if (!(await verifyScopeGroupExists(req.params.id))) {
    next()
    return
  }

  if (req.body.action === "delete") {
    await deleteScopeGroup(req.params.id)
    res.redirect(`/roles`)
  } else {
    next()
  }
})

router.post('/new', requireLoggedInMiddleware, newOrEditScopegroupProcessor, async function (req, res, next) {
  if (req.body.action === "edit") {
    const id = snowflake.generate()
    await updateScopeGroup(id, res.locals.scopegroup.name, res.locals.scopegroup.scopes)
    res.redirect(`/roles/${id}`)
  } else {
    next()
  }
})

export default router
