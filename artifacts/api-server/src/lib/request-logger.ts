import type { Request, Response, NextFunction } from "express";
import type { Logger } from "pino";
import { logger } from "./logger.js";

declare global {
  namespace Express {
    interface Request {
      log: Logger;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  req.log = logger.child({ reqId: Math.random().toString(36).slice(2, 10) });

  const start = Date.now();
  res.on("finish", () => {
    req.log.info({
      req: { method: req.method, url: req.url?.split("?")[0] },
      res: { statusCode: res.statusCode },
      responseTime: Date.now() - start,
    }, "request completed");
  });

  next();
}
