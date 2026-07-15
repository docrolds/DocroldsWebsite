/**
 * Environment variable type definitions
 * These types extend NodeJS.ProcessEnv to provide type safety for environment variables
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Server Configuration
      PORT?: string;
      NODE_ENV: 'development' | 'staging' | 'production' | 'test';

      // Database
      DATABASE_URL: string;

      // Authentication
      JWT_SECRET: string;
      JWT_CUSTOMER_SECRET: string;
      ADMIN_USERNAME: string;
      ADMIN_PASSWORD: string;

      // Square Payment
      SQUARE_APPLICATION_ID?: string;
      SQUARE_ACCESS_TOKEN?: string;
      SQUARE_LOCATION_ID?: string;
      SQUARE_ENVIRONMENT?: 'sandbox' | 'production';

      // Email Configuration (Gmail/SMTP)
      EMAIL_USER?: string;
      EMAIL_APP_PASS?: string;

      // SendGrid Configuration
      SENDGRID_API_KEY?: string;
      SENDGRID_FROM_EMAIL?: string;
      SENDGRID_FROM_NAME?: string;

      // Frontend URL (for email links)
      FRONTEND_URL?: string;

      // Download Settings
      DOWNLOAD_LINK_EXPIRY_DAYS?: string;

      // Error tracking
      SENTRY_DSN?: string;
    }
  }
}

export {};
