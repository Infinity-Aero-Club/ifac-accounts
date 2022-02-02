import express from "express"
import { userHasScope } from "../../src/scope"
import { createSessionToken } from "../../src/session"
import { getUserIdFromLogin } from "../../src/user"
import { validateWebAuthCookie } from "../../src/webtoken"

const router = express.Router()

export const invalidLoginVars = { title: 'Login', error: "Username and/or password is not correct" }
export const invalidPermsVars = { title: 'Login', error: "You do not have access to this page" }

router.get('/', async function (req, res, next) {
  if ("session" in req.cookies) {
    const valid = await validateWebAuthCookie(req.cookies.session) != null
    if (valid) {
      if ("redirect-to" in req.query && req.query["redirect-to"]?.toString().startsWith('/')) {
        res.redirect(req.query["redirect-to"].toString())
      } else {
        res.redirect("/home")
      }
      return
    }
  }
  res.render('login', { title: 'Login' })
})

router.post('/', async function (req, res, next) {
  if (!("username" in req.body) || !("password" in req.body)) {
    res.render('login', { title: 'Login', error: "Login details not supplied" })
    return
  }

  const userId = await getUserIdFromLogin(req.body.username, req.body.password)
  if (userId == null) {
    res.render('login', invalidLoginVars)
  } else {
    const hasAdmin = await userHasScope("admin", userId, false)
      if (!hasAdmin) {
        res.render('login', invalidPermsVars)
        return
      }
      const tokenDetails = await createSessionToken(userId, ["admin"], false)
      res.cookie("session", `User ${tokenDetails.token}`, { expires: new Date(Date.now() + tokenDetails.expiry*1000) })
      if ("redirect-to" in req.query && req.query["redirect-to"]?.toString().startsWith('/')) {
        res.redirect(req.query["redirect-to"].toString())
      } else {
        res.redirect("/home")
      }
      return
  }
})

export default router
