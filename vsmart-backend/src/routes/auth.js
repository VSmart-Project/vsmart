const { Router } = require('express');
const auth = require('../controllers/authController');
const { accountActionRateLimit, loginRateLimit } = require('../middleware/authRateLimit');

const router = Router();

router.post('/login', loginRateLimit, auth.login);
router.post('/register', accountActionRateLimit, auth.register);
router.post('/confirm', accountActionRateLimit, auth.confirmSignUp);
router.post('/resend-code', accountActionRateLimit, auth.resendCode);

module.exports = router;
