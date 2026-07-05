import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Parses a numeric route param into req.parsedParams[name] or 400s.
export function parseIntParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = parseInt(req.params[paramName], 10);
    if (isNaN(value)) {
      return res.status(400).json({ message: `Invalid ${paramName}` });
    }
    (req as any).parsedParams = { ...(req as any).parsedParams, [paramName]: value };
    next();
  };
}

// Wraps an async handler so rejected promises reach Express's error middleware.
export function handleAsyncErrors(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Validates req.body against a Zod schema, replacing it with the parsed value.
export function handleZodValidation<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      next(error);
    }
  };
}
