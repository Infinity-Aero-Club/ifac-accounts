import express, { RequestHandler } from "express"
import createError, { HttpError } from "http-errors";
import crypto from "crypto"
import { hgetAsync, sismemberAsync } from "../../src/rclient";
import { get_tokeninfo, get_tokeninfo_scope, post_tokeninfo_revoke } from "./tokeninfo";
import { get_me, get_me_hasscope, get_user, get_users } from "./users";
import { get_scope, get_scopegroup, get_scopegroups, get_scopes } from "./scopes";
import { getTokenUser } from "../../src/session";
import { get_userinfo } from "./userinfo";
import { ApiError } from "./error";

const router = express.Router();

export const NoTokenError = new ApiError("No token provided", null)
export const InvalidTokenError = new ApiError("Invalid token", "invalid_token")
export const InsufficientScopeError = new ApiError("Insufficient scope", "insufficient_scope")

router.use(async function (req, res, next) {
  if (req.headers.authorization == null) {
    throw NoTokenError
  }
  const [type, data] = req.headers.authorization.split(' ')
  if (type === "Basic" || type === "Application") {
    let appId, token: string | null = null
    if (type === "Basic") {
      [appId, token] = Buffer.from(data, 'base64').toString().split(':')
    } else if (type === "Application") {
      [appId, token] = data.split(':')
    }
    if (appId != null && token != null) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const validToken = (await sismemberAsync(`application:${appId}:tokenhashes`, tokenHash)) === 1
      if (validToken) {
        res.locals["appId"] = appId
        res.locals["appName"] = await hgetAsync(`application:${appId}`, "sht_name")
        res.locals["token"] = token
        return next()
      }
    }
  } else if (type === "Bearer") {
    const userId = await getTokenUser(data)
    if (userId != null) {
      res.locals["userId"] = userId
      res.locals["token"] = data
      return next()
    }
  }
  throw InvalidTokenError
})

export const requireAuthedAsUser: RequestHandler = async (req, res, next) => {
  if (res.locals["userId"] == null) throw InsufficientScopeError
  next()
}

export const requireAuthedAsApplication: RequestHandler = async (req, res, next) => {
  if (res.locals["appId"] == null) throw InsufficientScopeError
  next()
}

router.get('/tokeninfo', requireAuthedAsApplication, get_tokeninfo)
router.get('/tokeninfo/scope', requireAuthedAsApplication, get_tokeninfo_scope)
router.post('/tokeninfo/revoke', requireAuthedAsApplication, post_tokeninfo_revoke)
router.get('/users', requireAuthedAsApplication, get_users)
router.get('/user/:id', requireAuthedAsApplication, get_user)
router.get('/scopes', get_scopes)
router.get('/scope/:scope', get_scope)
router.get('/scopegroups', get_scopegroups)
router.get('/scopegroup/:id', get_scopegroup)
router.get('/me', requireAuthedAsUser, get_me)
router.get('/me/hasscope', requireAuthedAsUser, get_me_hasscope)
router.get('/userinfo', requireAuthedAsUser, get_userinfo)

router.use(function (req, res, next) {
  next(createError(404));
})

router.use(function (err: ApiError, req: express.Request, res: express.Response, next: express.NextFunction) {
  if (err.errType != null) {
    res.setHeader("WWW-Authenticate",
      "Bearer " +
      `error="${err.errType}", ` +
      `error_description="${err.message}"`)
  }
  res.status(err.statusCode ?? 500).json({ "error": err.message })
})

export default router
