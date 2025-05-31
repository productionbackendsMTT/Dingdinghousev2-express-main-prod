import { Request, Response, NextFunction } from "express";
import { HttpError } from "http-errors";
import { config } from "../../common/config/config";
import { errorResponse } from "../../common/lib/response";

const errorHandler = (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  const errorStack = config.env === "development" ? err.stack : "";

  if (res.headersSent) {
    return next(err); // Let default Express handler deal with it
  }

  return res.status(status).json(errorResponse(status, message, errorStack));
};

export default errorHandler;
