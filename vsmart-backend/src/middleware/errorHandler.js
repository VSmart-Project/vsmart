/**
 * Global error handler middleware
 * Must be registered as the LAST middleware in Express.
 */
const errorHandler = (err, req, res, next) => {
    const isDev = process.env.NODE_ENV === 'development';

    console.error(`[ErrorHandler] ${req.method} ${req.path}:`, err);

    // AWS SDK specific errors
    if (err.name === 'ResourceNotFoundException') {
        return res.status(404).json({
            success: false,
            message: 'AWS resource not found',
            error: isDev ? err.message : undefined,
        });
    }

    if (err.name === 'AccessDeniedException' || err.name === 'UnauthorizedException') {
        return res.status(403).json({
            success: false,
            message: 'Access denied to AWS resource',
            error: isDev ? err.message : undefined,
        });
    }

    // Generic server error
    return res.status(err.statusCode || err.status || 500).json({
        success: false,
        message: err.userMessage || 'Internal server error',
        error: isDev ? err.message : undefined,
        stack: isDev ? err.stack : undefined,
    });
};

/**
 * 404 handler — used for unmatched routes
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`,
    });
};

module.exports = { errorHandler, notFoundHandler };
