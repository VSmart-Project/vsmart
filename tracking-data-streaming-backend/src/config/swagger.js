const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'VSmart Tracking API',
            version: '1.0.0',
            description: 'Tài liệu API cho Đồ án Giám sát phương tiện mượn/trả VSmart',
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Local server',
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Nhập Cognito JWT ID Token của bạn vào đây (KHÔNG bao gồm chữ Bearer).',
                },
            },
        },
        // Mặc định bọc toàn bộ API bằng lớp bảo mật BearerAuth
        security: [
            {
                BearerAuth: [],
            },
        ],
    },
    // Scan các file định dạng comment .js trong thư mục routes
    apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
