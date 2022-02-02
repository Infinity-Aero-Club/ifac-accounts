import express from "express"
import { requireLoggedInMiddleware } from "../../../src/webtoken";
import appsRouter from "./apps"

const router = express.Router();

router.get('/', requireLoggedInMiddleware, function(req, res, next) {
  res.render('developer/dev_home', { title: 'Developer home', page: "dev_home" });
})

router.use('/apps', appsRouter)

export default router
