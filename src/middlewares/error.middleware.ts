import { Request, Response, NextFunction } from 'express';
import { HttpError } from 'http-errors';
import { errorResponse } from '../utils';
import { config } from '../config/config';

const errorHandler = (err: HttpError, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    const errorStack = config.env === "development" ? err.stack : "";

    return res.status(status).json(errorResponse(status, message, errorStack));
}

export default errorHandler;