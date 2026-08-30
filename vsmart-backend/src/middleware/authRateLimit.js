const { rateLimit } = require('express-rate-limit');

const createLimiter = (windowMs, limit) => rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({
        message: 'Too many authentication attempts. Please try again later.',
    }),
});

const loginRateLimit = createLimiter(15 * 60 * 1000, 10);
const accountActionRateLimit = createLimiter(60 * 60 * 1000, 5);

module.exports = { accountActionRateLimit, loginRateLimit };
