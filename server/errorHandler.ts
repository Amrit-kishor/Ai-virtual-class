import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_SERVER_ERROR';

  logger.error(
    {
      err,
      url: req.originalUrl,
      method: req.method,
      statusCode,
    },
    err.message
  );

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'An unexpected server error occurred.',
      code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
}
