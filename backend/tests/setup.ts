// Required env vars must be set before any module (like src/config/env.ts)
// is imported, since config validation runs at import time.
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_CUSTOMER_SECRET = 'test-jwt-customer-secret';
process.env.SQUARE_APPLICATION_ID = 'test-square-app-id';
process.env.SQUARE_ACCESS_TOKEN = 'test-square-access-token';
process.env.SQUARE_LOCATION_ID = 'test-square-location-id';
process.env.NODE_ENV = 'test';
