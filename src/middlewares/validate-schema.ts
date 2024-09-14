import * as Yup from 'yup';

import { AnySchema } from "yup"
import { Request, Response, NextFunction } from "express"

/**
 * Middleware to validate a request against a schema.
 * @param schema The schema to validate against.
 * @returns A middleware function that validates the request.
 */
export const validate = (schema: AnySchema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.validate({
                body: req.body,
                query: req.query,
                params: req.params,
            })

            const { params, query, body } = schema.cast({
                params: req.params,
                query: req.query,
                body: req.body,
            })

            req.params = params
            req.query = query
            req.body = body

            return next()
        } catch (err) {
            return res.status(400).json({
                message: "Validation Error",
                errors: err.errors,
            })
        }
    }
}

export const honeypotV2CheckSchema = Yup.object({
    body : Yup.object({
        routerAddress : Yup.string().required(), 
        accountToOverride : Yup.string().required(), 
        tokenTargetAddress : Yup.string().required(), 
        mainTokenAddress : Yup.string().required(), 
        amountMainToken : Yup.string().required(), 
        mainTokenBalanceSlot : Yup.number().required(),
    })
});