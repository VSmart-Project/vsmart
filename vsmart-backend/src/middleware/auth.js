const { CognitoJwtVerifier } = require("aws-jwt-verify");

let verifier;

try {
    verifier = CognitoJwtVerifier.create({
        userPoolId: process.env.COGNITO_USER_POOL_ID || "YOUR_USER_POOL_ID",
        tokenUse: "id", // Frontend sends ID token usually via Amplify
        clientId: process.env.COGNITO_CLIENT_ID || "YOUR_CLIENT_ID",
    });
} catch (err) {
    console.error("Failed to initialize CognitoJwtVerifier:", err.message);
}

const verifyJwt = async (token) => {
    if (!verifier) {
        throw new Error("Verifier is not initialized. Check COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID.");
    }
    return verifier.verify(token);
};

const requireAuth = async (req, res, next) => {
    // 1. Kiểm tra header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Unauthorized: Missing or invalid Authorization header"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        // 2. Xác thực và giải mã token
        const payload = await verifyJwt(token);

        // 3. Gắn thông tin User (từ mã JWT) vào req object để các Controller sau này xài
        req.user = payload;

        next(); // Chuyển tiếp request vào hệ thống xử lý API
    } catch (err) {
        console.error("JWT Verification failed:", err.message);
        return res.status(401).json({
            message: "Unauthorized: Token expired or invalid"
        });
    }
};

module.exports = { requireAuth, verifyJwt };
