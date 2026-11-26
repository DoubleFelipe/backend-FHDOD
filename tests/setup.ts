// Tests never use runtime credentials, local .env values or an external database.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/not-used';
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-'.repeat(3);
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-'.repeat(3);
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.RATE_LIMIT_MAX = '10000';
process.env.LOGIN_RATE_LIMIT_MAX = '100';
process.env.PUBLIC_SUBMISSION_RATE_LIMIT_MAX = '100';
process.env.PUBLIC_SUBMISSION_MAX_FIELDS = '30';
process.env.PUBLIC_SUBMISSION_MAX_TEXT_LENGTH = '4000';
