const {
  CognitoIdentityProviderClient,
  DescribeUserPoolClientCommand,
  UpdateUserPoolClientCommand
} = require("@aws-sdk/client-cognito-identity-provider");
require("dotenv").config();

async function main() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const region = process.env.AWS_REGION || "ap-southeast-1";

  if (!userPoolId || !clientId) {
    console.error("Lỗi: Thiếu COGNITO_USER_POOL_ID hoặc COGNITO_CLIENT_ID trong file .env");
    process.exit(1);
  }

  const client = new CognitoIdentityProviderClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  try {
    console.log(`Đang kiểm tra App Client ${clientId} trong User Pool ${userPoolId}...`);
    const describeResult = await client.send(
      new DescribeUserPoolClientCommand({
        UserPoolId: userPoolId,
        ClientId: clientId
      })
    );

    const appClient = describeResult.UserPoolClient;
    const existingFlows = appClient.ExplicitAuthFlows || [];
    console.log("Các flows hiện tại:", existingFlows);

    const requiredFlows = ["ALLOW_ADMIN_USER_PASSWORD_AUTH", "ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"];
    
    // Hợp nhất các flows và loại bỏ các giá trị trùng lặp
    const newFlows = Array.from(new Set([...existingFlows, ...requiredFlows]));

    console.log("Đang kích hoạt flows mới:", newFlows);

    await client.send(
      new UpdateUserPoolClientCommand({
        UserPoolId: userPoolId,
        ClientId: clientId,
        ClientName: appClient.ClientName,
        ExplicitAuthFlows: newFlows,
        TokenValidityUnits: appClient.TokenValidityUnits,
        AccessTokenValidity: appClient.AccessTokenValidity,
        IdTokenValidity: appClient.IdTokenValidity,
        RefreshTokenValidity: appClient.RefreshTokenValidity,
        PreventUserExistenceErrors: appClient.PreventUserExistenceErrors,
        EnableTokenRevocation: appClient.EnableTokenRevocation
      })
    );

    console.log("✅ Cập nhật thành công! Đã bật flow 'ADMIN_USER_PASSWORD_AUTH' và 'USER_PASSWORD_AUTH'.");
  } catch (error) {
    console.error("❌ Thất bại khi cập nhật App Client:", error.message);
    console.log("\nBạn có thể cấu hình thủ công trong AWS Console:");
    console.log("1. Truy cập AWS Cognito Console -> User Pools -> Chọn User Pool của bạn.");
    console.log("2. Chọn tab 'App integration' (Tích hợp ứng dụng).");
    console.log("3. Kéo xuống phần 'App client list' -> Chọn App Client của bạn.");
    console.log("4. Ở phần 'Hosted UI settings' hoặc 'Authentication flows', bấm 'Edit'.");
    console.log("5. Chọn (tích) vào checkbox 'ALLOW_ADMIN_USER_PASSWORD_AUTH' (hoặc Admin User Password Auth) và 'ALLOW_USER_PASSWORD_AUTH'.");
    console.log("6. Bấm Save changes.");
  }
}

main();
