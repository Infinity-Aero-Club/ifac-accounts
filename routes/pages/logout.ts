import express from "express"
import { revokeToken } from "../../src/session"
import { getWebTokenFromCookie } from "../../src/webtoken"

const router = express.Router()

router.get('/', async function (req, res, next) {
  const token = getWebTokenFromCookie(req.cookies.session)
  if (token != null) {
    await revokeToken(token)
  }
  res.clearCookie("session")
  res.redirect('/')
})

export default router
