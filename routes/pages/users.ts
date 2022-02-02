import express, { RequestHandler } from "express"
import { getScopeGroupIds, getScopeGroupNameFromId, ScopeGroupDetails, getScopeGroupDetails, userHasScope, getScopesByApplicationId } from "../../src/scope"
import { deleteUser, FullUserDetails, getFullUserDetailsFromId, getTerminatedUserIds, getUserFullNameFromId, getUserIdFromName, getUserIdFromPin, getUserIds, getUserNameFromId, reinstateUser, removeUserPassword, setUserPassword, terminateUser, updateUser, verifyUserExists } from "../../src/user"
import { requireLoggedInMiddleware } from "../../src/webtoken"
import multer from "multer"
import { snowflake } from "../../app"
import { uploadUserFile } from "../../src/cdn"
import rclient from "../../src/rclient"
import { getAllApplicationIds, getApplicationNameFromId, getApplicationShtNameFromId } from "../../src/application"

const router = express.Router()

router.get('/', requireLoggedInMiddleware, async function (req, res, next) {
  const users = []
  const userIds = await getUserIds()
  for (const userId of userIds) {
    users.push({
      id: userId,
      name: (await getUserFullNameFromId(userId))!
    })
  }
  res.render('users/users', { title: 'Users', page: "users", users: users.sort((a, b) => a.name.localeCompare(b.name)) })
})

router.get('/terminated', requireLoggedInMiddleware, async function (req, res, next) {
  const users = []
  const userIds = await getTerminatedUserIds()
  for (const userId of userIds) {
    users.push({
      id: userId,
      name: (await getUserFullNameFromId(userId))!
    })
  }
  res.render('users/terminated-users', { title: 'Users', page: "terminated-users", users: users.sort((a, b) => a.name.localeCompare(b.name)) })
})

const newOrEditUserPreparer: RequestHandler = async (req, res, next) => {
  const scopegroups = []
  const scopeGroupIds = await getScopeGroupIds()
  for (const scopeGroupId of scopeGroupIds) {
    scopegroups.push({
      id: scopeGroupId,
      name: await getScopeGroupNameFromId(scopeGroupId)
    })
  }
  res.locals.scopegroups = scopegroups

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

router.get('/new', requireLoggedInMiddleware, newOrEditUserPreparer, async function (req, res, next) {
  res.render('users/new_or_edit_user', { title: 'New User', page: "users", isNew: true, scopeGroups: res.locals.scopegroups, appScopes: res.locals.appScopes, error: res.locals.error, user: res.locals.user })
})

const newOrEditUserProcessor: RequestHandler = async (req, res, next) => {
  if (req.body.action !== "edit") {
    next()
    return
  }
  const fullName = req.body["full-name"]
  const username = req.body["username"]
  const pin = req.body["pin"]
  const onboardDate = Math.round(new Date(req.body["onboard-date"]).getTime() / 1000)
  const scopegroup = {
    id: req.body["scopegroup"],
    name: null,
    scopes: null,
  }
  const admin = Object.keys(req.body).includes("admin")

  const allowedScopes = []
  const disallowedScopes = []
  for (const scopeParam of Object.keys(req.body).filter((v) => v.startsWith("scope-"))) {
    const scope = scopeParam.replace("scope-", "")
    const value = req.body[scopeParam]
    if (value === "grant") {
      allowedScopes.push(scope)
    } else if (value === "deny") {
      disallowedScopes.push(scope)
    }
  }

  const user = {
    fullName,
    username,
    pin,
    onboardDate,
    admin,
    terminated: false,
    terminatedAt: null,
    allowedScopes,
    disallowedScopes,
    scopegroup,
    files: null,
    notes: null,
    id: null,
    scopes: null,
  }
  res.locals.user = user

  if (fullName.length === 0 || username.length === 0 || pin.length === 0) {
    res.locals.error = "Please fill out all fields"
    req.method = 'GET';
    (router as any)["handle"](req, res, next)
    return
  }

  if (!/^\d+$/.test(pin)) {
    res.locals.error = "Pin must be only digits"
    req.method = 'GET';
    (router as any)["handle"](req, res, next)
    return
  }

  if (!/^[A-Za-z-_.]+$/.test(username)) {
    res.locals.error = "Invalid username"
    req.method = 'GET';
    (router as any)["handle"](req, res, next)
    return
  }

  if (pin.length < 4) {
    res.locals.error = "Pin must at least 4 digits"
    req.method = 'GET';
    (router as any)["handle"](req, res, next)
    return
  }

  const usernameAssignedTo = await getUserIdFromName(username)
  if (usernameAssignedTo != null && usernameAssignedTo !== req.params.id) {
    res.locals.error = "Username already taken"
    req.method = 'GET';
    (router as any)["handle"](req, res, next)
    return
  }

  const pinAssignedTo = await getUserIdFromPin(pin)
  if (pinAssignedTo != null && pinAssignedTo !== req.params.id) {
    res.locals.error = "Pin already taken"
    req.method = 'GET';
    (router as any)["handle"](req, res, next)
    return
  }

  next()
}

router.post('/new', requireLoggedInMiddleware, newOrEditUserProcessor, async function (req, res, next) {
  if (req.body.action === "edit") {
    const id = snowflake.generate()
    await updateUser(
      id,
      res.locals.user.username,
      res.locals.user.fullName,
      res.locals.user.pin,
      res.locals.user.admin,
      res.locals.user.scopegroup.id,
      res.locals.user.onboardDate,
      res.locals.user.allowedScopes,
      res.locals.user.disallowedScopes
    )
    res.redirect(`/users/${id}/resetpassword?new=true`)
  } else {
    next()
  }
})

router.get('/:id', requireLoggedInMiddleware, async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    return next()
  }
  const user = (await getFullUserDetailsFromId(req.params.id))!!
  let message = null
  res.render('users/user', { title: 'User', page: user.terminated ? "terminated-users" : "users", user, message })
})

router.get('/:id/edit', requireLoggedInMiddleware, newOrEditUserPreparer, async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    next()
    return
  }
  const user = await getFullUserDetailsFromId(req.params.id)
  res.render('users/new_or_edit_user', { title: 'Edit User', page: "users", isNew: false, scopeGroups: res.locals.scopegroups, appScopes: res.locals.appScopes, error: res.locals.error, user: res.locals.user || user })
})

router.post('/:id/edit', requireLoggedInMiddleware, newOrEditUserProcessor, async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    next()
    return
  }

  if (req.body.action === "edit") {
    await updateUser(
      req.params.id,
      res.locals.user.username,
      res.locals.user.fullName,
      res.locals.user.pin,
      res.locals.user.admin,
      res.locals.user.scopegroup.id,
      res.locals.user.onboardDate,
      res.locals.user.allowedScopes,
      res.locals.user.disallowedScopes
    )
    res.redirect(`/users/${req.params.id}`)
  } else {
    next()
  }
})

router.post(`/:id/edit`, requireLoggedInMiddleware, newOrEditUserProcessor, async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    return next()
  }

  if (req.body.action === "terminate") {
    await terminateUser(req.params.id)
    res.redirect(`/users/${req.params.id}`)
  }
})

router.post('/:id', requireLoggedInMiddleware, multer().single("file"), async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    return next()
  }
  if (req.body.action === "upload-file") {
    const fileName = req.body["file-name"]
    const file = req["file"]
    const fileId = snowflake.generate()
    const fileUrl = uploadUserFile(req.params.id, fileId, file)
    rclient.hmset(`user:${req.params.id}:file:${fileId}`, {
      url: fileUrl,
      name: fileName,
      uploadTimestamp: Math.round(Date.now() / 1000).toString()
    })
    rclient.sadd(`user:${req.params.id}:files`, fileId)
    res.redirect(303, `/users/${req.params.id}`)
  } else {
    next()
  }
})

router.post('/:id', requireLoggedInMiddleware, async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    return next()
  }
  if (req.body.action === "delete-file") {
    const fileId = req.body["file-id"]
    rclient.del(`user:${req.params.id}:file:${fileId}`)
    rclient.srem(`user:${req.params.id}:files`, fileId)
    res.redirect(303, `/users/${req.params.id}`)
  } else {
    next()
  }
})

router.post('/:id', requireLoggedInMiddleware, async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    return next()
  }
  if (req.body.action === "add-note") {
    const noteName = req.body["note-name"]
    const noteContents = req.body["note-contents"]
    const noteId = snowflake.generate()
    rclient.hmset(`user:${req.params.id}:note:${noteId}`, {
      content: noteContents,
      name: noteName,
      timestamp: Math.round(Date.now() / 1000).toString()
    })
    rclient.sadd(`user:${req.params.id}:notes`, noteId)
    res.redirect(303, `/users/${req.params.id}`)
  } else {
    next()
  }
})

router.post('/:id', requireLoggedInMiddleware, async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    return next()
  }
  if (req.body.action === "delete-note") {
    const noteId = req.body["note-id"]
    rclient.del(`user:${req.params.id}:note:${noteId}`)
    rclient.srem(`user:${req.params.id}:notes`, noteId)
    res.redirect(303, `/users/${req.params.id}`)
  } else {
    next()
  }
})

router.post('/:id', requireLoggedInMiddleware, async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    return next()
  }
  if (req.body.action === "reinstate") {
    await reinstateUser(req.params.id)
    res.redirect(`/users/${req.params.id}/edit`)
  } else {
    next()
  }
})

router.post('/:id', requireLoggedInMiddleware, async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    return next()
  }
  if (req.body.action === "delete") {
    await deleteUser(req.params.id)
    res.redirect(`/users/terminated`)
  } else {
    next()
  }
})

router.get('/:id/resetpassword', requireLoggedInMiddleware, async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    next()
    return
  }
  const isNew = req.query.new === "true"
  const username = await getUserNameFromId(req.params.id)
  res.render('users/set_user_password', { title: isNew ? "Set Password" : "Reset Password", page: "users", username, isNew, userId: req.params.id })
})

router.post('/:id/resetpassword', requireLoggedInMiddleware, async function (req, res, next) {
  if (!(await verifyUserExists(req.params.id))) {
    next()
    return
  }
  const newPassword = req.body.password
  if (newPassword.length > 0) {
    await setUserPassword(req.params.id, newPassword)
  } else {
    await removeUserPassword(req.params.id)
  }
  res.redirect(`/users/${req.params.id}`)
})

export default router
