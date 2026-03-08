/**
 * Error Handler Middleware
 * Centralized error handling for the API
 */

const logger = require('../services/logger');

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create common error types
 */
const createError = {
  badRequest: (message = 'Bad request', details = null) => 
    new ApiError(400, message, details),
  
  unauthorized: (message = 'Unauthorized') => 
    new ApiError(401, message),
  
  forbidden: (message = 'Forbidden') => 
    new ApiError(403, message),
  
  notFound: (message = 'Not found') => 
    new ApiError(404, message),
  
  conflict: (message = 'Conflict') => 
    new ApiError(409, message),
  
  tooManyRequests: (message = 'Too many requests') => 
    new ApiError(429, message),
  
  internal: (message = 'Internal server error') => 
    new ApiError(500, message)
};

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('API Error:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.userId
  });

  // Handle known operational errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details
    });
  }

  // Handle validation errors from express-validator
  if (err.array && typeof err.array === 'function') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.array()
    });
  }

  // Handle Mongoose/MongoDB errors
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format'
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate entry'
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired'
    });
  }

  // Default error response for unexpected errors
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { 
  errorHandler, 
  ApiError, 
  createError,
  asyncHandler 
};
