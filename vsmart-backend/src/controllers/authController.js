const {
    CognitoIdentityProviderClient,
    AdminInitiateAuthCommand,
    SignUpCommand,
    ConfirmSignUpCommand,
    ResendConfirmationCodeCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

const normalizeEmail = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const isValidEmail = (value) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidPassword = (value, minimumLength = 1) => typeof value === 'string'
    && value.length >= minimumLength
    && value.length <= 256;

exports.login = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!isValidEmail(email) || !isValidPassword(password)) {
        return res.status(400).json({ message: 'Email hoặc mật khẩu không hợp lệ' });
    }

    try {
        const result = await client.send(new AdminInitiateAuthCommand({
            AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
            UserPoolId: USER_POOL_ID,
            ClientId: CLIENT_ID,
            AuthParameters: { USERNAME: email, PASSWORD: password },
        }));

        const auth = result.AuthenticationResult;
        return res.json({
            idToken: auth.IdToken,
            accessToken: auth.AccessToken,
            refreshToken: auth.RefreshToken,
            expiresIn: auth.ExpiresIn,
        });
    } catch (err) {
        if (['NotAuthorizedException', 'UserNotConfirmedException', 'UserNotFoundException'].includes(err.name)) {
            return res.status(401).json({ message: 'Email, mật khẩu hoặc trạng thái tài khoản không hợp lệ' });
        }
        console.error('[Auth] Login failed:', err.name);
        return res.status(500).json({ message: 'Không thể đăng nhập lúc này' });
    }
};

exports.register = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!isValidEmail(email) || !isValidPassword(password, 12)) {
        return res.status(400).json({ message: 'Email không hợp lệ hoặc mật khẩu ngắn hơn 12 ký tự' });
    }

    try {
        const result = await client.send(new SignUpCommand({
            ClientId: CLIENT_ID,
            Username: email,
            Password: password,
            UserAttributes: [{ Name: 'email', Value: email }],
        }));

        return res.json({
            userSub: result.UserSub,
            confirmed: result.UserConfirmed,
        });
    } catch (err) {
        if (err.name === 'UsernameExistsException') {
            return res.status(202).json({ message: 'Nếu email hợp lệ, hướng dẫn xác thực sẽ được gửi.' });
        }
        if (['InvalidPasswordException', 'InvalidParameterException'].includes(err.name)) {
            return res.status(400).json({ message: 'Thông tin đăng ký không đáp ứng yêu cầu bảo mật' });
        }
        console.error('[Auth] Registration failed:', err.name);
        return res.status(500).json({ message: 'Không thể đăng ký lúc này' });
    }
};

exports.confirmSignUp = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: 'Email và mã xác thực là bắt buộc' });
    }

    try {
        await client.send(new ConfirmSignUpCommand({
            ClientId: CLIENT_ID,
            Username: email,
            ConfirmationCode: code,
        }));
        return res.json({ message: 'Xác thực thành công' });
    } catch (err) {
        return res.status(400).json({ message: 'Mã xác thực không hợp lệ hoặc đã hết hạn' });
    }
};

exports.resendCode = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Email là bắt buộc' });
    }

    try {
        await client.send(new ResendConfirmationCodeCommand({
            ClientId: CLIENT_ID,
            Username: email,
        }));
        return res.json({ message: 'Đã gửi lại mã xác thực' });
    } catch (err) {
        if (['UserNotFoundException', 'InvalidParameterException'].includes(err.name)) {
            return res.json({ message: 'Nếu email tồn tại, mã xác thực mới sẽ được gửi.' });
        }
        console.error('[Auth] Resend code failed:', err.name);
        return res.status(500).json({ message: 'Không thể gửi mã lúc này' });
    }
};
