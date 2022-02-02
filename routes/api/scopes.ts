import { RequestHandler } from "express"
import { getAllScopes, getScopeGroupIds, getScopeDetails, getScopeGroupDetails } from "../../src/scope"

export const get_scopes: RequestHandler = async (req, res, next) => {
    res.json(await getAllScopes())
}

export const get_scope: RequestHandler = async (req, res, next) => {
    res.json(await getScopeDetails(req.params.scope))
}

export const get_scopegroups: RequestHandler = async (req, res, next) => {
    const scopegroups = []
    const scopeGroupIds = await getScopeGroupIds()
    for (const scopeGroupId of scopeGroupIds) {
        scopegroups.push(await getScopeGroupDetails(scopeGroupId))
    }
    res.json(scopegroups)
}

export const get_scopegroup: RequestHandler = async (req, res, next) => {
    const sgDetails = await getScopeGroupDetails(req.params.id)
    res.status(sgDetails == null ? 404 : 200).json(sgDetails)
}