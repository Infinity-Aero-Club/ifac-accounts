import express from "express"
import indexRouter from "./pages/index"
import homeRouter from "./pages/home"
import usersRouter from "./pages/users"
import scopegroupsRouter from "./pages/scopegroups"
import loginRouter from "./pages/login"
import logoutRouter from "./pages/logout"
import developerRouter from "./pages/developer/dev_entrypoint"
import apiRouter from "./api/api"
import oauthRouter from "./oauth/oauth";
import wellKnownRouter from "./oauth/wellKnown";

const router = express.Router();

router.use('/', indexRouter)
router.use('/login', loginRouter)
router.use('/logout', logoutRouter)
router.use('/home', homeRouter)
router.use('/users', usersRouter)
router.use('/roles', scopegroupsRouter)
router.use('/developer', developerRouter)
router.use('/api', apiRouter)
router.use('/oauth', oauthRouter)
router.use('/.well-known', wellKnownRouter)

export default router
