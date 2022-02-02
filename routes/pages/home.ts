import express from "express"
import { requireLoggedInMiddleware } from "../../src/webtoken";
const router = express.Router();

router.get('/', requireLoggedInMiddleware, function(req, res, next) {
  res.render('home', { title: 'Home', page: "home" });
});

export default router
