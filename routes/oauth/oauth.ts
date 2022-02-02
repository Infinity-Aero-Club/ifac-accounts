import express from "express"
import authorizeRouter from "./authorize"
import { OauthError } from "./error"
import tokenRouter from "./token"

const router = express.Router()

router.use('/authorize', authorizeRouter)
router.use('/token', tokenRouter)

router.use('/clientredirect', async function (req, res, next) {
    res.send("Please wait...")
})

router.use((err: OauthError, req: any, res: any, next: any) => {
    res.status(err.statusCode ?? 400).json({ 
        "error": err.errType ?? "invalid_request",
        "error_description": err.message ?? "Unknown error"
    })
})

export default router