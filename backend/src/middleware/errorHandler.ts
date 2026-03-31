import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

// ─── AppError Class ───────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// ─── Common Error Factories ───────────────────────────────────────────────────

export const Errors = {
  notFound: (resource: string) =>
    new AppError(`${resource} not found`, 404, "NOT_FOUND"),

  unauthorized: (message = "Unauthorized") =>
    new AppError(message, 401, "UNAUTHORIZED"),

  forbidden: (message = "Access denied") =>
    new AppError(message, 403, "FORBIDDEN"),

  badRequest: (message: string) =>
    new AppError(message, 400, "BAD_REQUEST"),

  conflict: (message: string) =>
    new AppError(message, 409, "CONFLICT"),

  internalServer: (message = "Internal server error") =>
    new AppError(message, 500, "INTERNAL_SERVER_ERROR", false),

  tooManyRequests: (message = "Too many requests") =>
    new AppError(message, 429, "TOO_MANY_REQUESTS"),

  unprocessable: (message: string) =>
    new AppError(message, 422, "UNPROCESSABLE_ENTITY"),
};

// ─── Error Response Interface ─────────────────────────────────────────────────

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: unknown;
    stack?: string;
  };
}

// ─── Format Zod Errors ────────────────────────────────────────────────────────

function formatZodError(error: ZodError): string {
  return error.errors
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join("; ");
}

// ─── Format Prisma Errors ─────────────────────────────────────────────────────

function formatPrismaError(error: Prisma.PrismaClientKnownRequestError): {
  message: string;
  statusCode: number;
} {
  switch (error.code) {
    case "P2002": {
      const fields = (error.meta?.target as string[])?.join(", ") || "field";
      return {
        message: `A record with this ${fields} already exists`,
        statusCode: 409,
      };
    }
    case "P2025":
      return { message: "Record not found", statusCode: 404 };
    case "P2003":
      return {
        message: "Referenced record not found (foreign key constraint)",
        statusCode: 400,
      };
    case "P2014":
      return { message: "Invalid relation data provided", statusCode: 400 };
    default:
      return { message: "Database operation failed", statusCode: 500 };
  }
}

// ─── Global Error Handler Middleware ─────────────────────────────────────────

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const isDev = process.env.NODE_ENV === "development";

  // ── AppError (operational errors) ────────────────────────────────────────
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        ...(isDev && { stack: err.stack }),
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // ── Zod Validation Error ──────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        statusCode: 422,
        details: err.errors,
        ...(isDev && { stack: err.stack }),
      },
    };
    res.status(422).json(response);
    return;
  }

  // ── Prisma Known Request Error ────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const { message, statusCode } = formatPrismaError(err);
    const response: ErrorResponse = {
      success: false,
      error: {
        message,
        code: `PRISMA_${err.code}`,
        statusCode,
        ...(isDev && { stack: err.stack }),
      },
    };
    res.status(statusCode).json(response);
    return;
  }

  // ── Prisma Validation Error ───────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientValidationError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: "Invalid data provided to database",
        code: "PRISMA_VALIDATION",
        statusCode: 400,
        ...(isDev && { stack: err.stack }),
      },
    };
    res.status(400).json(response);
    return;
  }

  // ── Multer Errors ─────────────────────────────────────────────────────────
  if (err.name === "MulterError") {
    const multerError = err as Error & { code: string };
    let message = "File upload failed";
    let statusCode = 400;

    if (multerError.code === "LIMIT_FILE_SIZE") {
      message = `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 10}MB`;
      statusCode = 413;
    } else if (multerError.code === "LIMIT_FILE_COUNT") {
      message = "Too many files uploaded";
      statusCode = 400;
    } else if (multerError.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Unexpected file field";
      statusCode = 400;
    }

    const response: ErrorResponse = {
      success: false,
      error: { message, code: "FILE_UPLOAD_ERROR", statusCode },
    };
    res.status(statusCode).json(response);
    return;
  }

  // ── JWT Errors ────────────────────────────────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: "Invalid authentication token",
        code: "INVALID_TOKEN",
        statusCode: 401,
      },
    };
    res.status(401).json(response);
    return;
  }

  if (err.name === "TokenExpiredError") {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: "Token expired",
        code: "TOKEN_EXPIRED",
        statusCode: 401,
      },
    };
    res.status(401).json(response);
    return;
  }

  // ── Unknown / Unexpected Errors ───────────────────────────────────────────
  console.error("Unhandled error:", err);

  const response: ErrorResponse = {
    success: false,
    error: {
      message: isDev ? err.message : "An unexpected error occurred",
      code: "INTERNAL_SERVER_ERROR",
      statusCode: 500,
      ...(isDev && { stack: err.stack }),
    },
  };
  res.status(500).json(response);
}

// ─── Not Found Handler ────────────────────────────────────────────────────────

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route ${req.method} ${req.path} not found`, 404, "ROUTE_NOT_FOUND"));
}
