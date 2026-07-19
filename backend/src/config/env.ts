import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Environment variable configuration types
 */
interface DatabaseConfig {
  url: string;
}

interface AuthConfig {
  jwtSecret: string;
  jwtCustomerSecret: string;
  adminUsername: string;
  adminPassword: string;
}

interface SquareConfig {
  applicationId: string;
  accessToken: string;
  locationId: string;
  environment: 'sandbox' | 'production';
  webhookSignatureKey: string | undefined;
  webhookNotificationUrl: string | undefined;
}

interface EmailConfig {
  user: string;
  appPass: string;
}

interface SendGridConfig {
  apiKey: string | undefined;
  fromEmail: string;
  fromName: string;
}

interface BrevoConfig {
  apiKey: string | undefined;
  fromEmail: string;
  fromName: string;
}

interface R2Config {
  accountId: string | undefined;
  accessKeyId: string | undefined;
  secretAccessKey: string | undefined;
  bucketName: string | undefined;
}

interface Config {
  port: number;
  nodeEnv: 'development' | 'production' | 'staging' | 'test';
  database: DatabaseConfig;
  auth: AuthConfig;
  square: SquareConfig;
  email: EmailConfig;
  sendgrid: SendGridConfig;
  brevo: BrevoConfig;
  r2: R2Config;
  frontendUrl: string;
  downloadLinkExpiryDays: number;
  sentryDsn: string | undefined;
}

/**
 * Validates that a required environment variable is present
 * @throws Error if the variable is missing
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[CONFIG] Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value
 */
function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Gets an optional integer environment variable with a default value
 */
function optionalIntEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`[CONFIG] Invalid integer for ${name}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

/**
 * Validates and builds the configuration object
 * @throws Error if required environment variables are missing
 */
function buildConfig(): Config {
  // Collect all missing required variables for a comprehensive error message
  const missingVars: string[] = [];

  const checkRequired = (name: string): string => {
    const value = process.env[name];
    if (!value) {
      missingVars.push(name);
      return ''; // Return empty string to continue validation
    }
    return value;
  };

  // Check all required variables
  const databaseUrl = checkRequired('DATABASE_URL');
  const adminUsername = checkRequired('ADMIN_USERNAME');
  const adminPassword = checkRequired('ADMIN_PASSWORD');
  const jwtSecret = checkRequired('JWT_SECRET');
  const jwtCustomerSecret = checkRequired('JWT_CUSTOMER_SECRET');
  const squareApplicationId = checkRequired('SQUARE_APPLICATION_ID');
  const squareAccessToken = checkRequired('SQUARE_ACCESS_TOKEN');
  const squareLocationId = checkRequired('SQUARE_LOCATION_ID');

  // Throw comprehensive error if any required variables are missing
  if (missingVars.length > 0) {
    throw new Error(
      `[CONFIG] Missing required environment variables:\n` +
      missingVars.map(v => `  - ${v}`).join('\n') +
      `\n\nPlease check your .env file or environment configuration.`
    );
  }

  // Validate Square environment
  const squareEnv = optionalEnv('SQUARE_ENVIRONMENT', 'sandbox');
  if (squareEnv !== 'sandbox' && squareEnv !== 'production') {
    throw new Error(
      `[CONFIG] Invalid SQUARE_ENVIRONMENT: "${squareEnv}". Must be "sandbox" or "production".`
    );
  }

  // Validate Node environment
  const nodeEnv = optionalEnv('NODE_ENV', 'development');
  const validNodeEnvs = ['development', 'production', 'staging', 'test'];
  if (!validNodeEnvs.includes(nodeEnv)) {
    console.warn(
      `[CONFIG] Unknown NODE_ENV: "${nodeEnv}". Expected one of: ${validNodeEnvs.join(', ')}`
    );
  }

  return {
    port: optionalIntEnv('PORT', 3000),
    nodeEnv: nodeEnv as Config['nodeEnv'],

    database: {
      url: databaseUrl,
    },

    auth: {
      jwtSecret,
      jwtCustomerSecret,
      adminUsername,
      adminPassword,
    },

    square: {
      applicationId: squareApplicationId,
      accessToken: squareAccessToken,
      locationId: squareLocationId,
      environment: squareEnv as SquareConfig['environment'],
      webhookSignatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
      webhookNotificationUrl: process.env.SQUARE_WEBHOOK_NOTIFICATION_URL,
    },

    email: {
      user: optionalEnv('EMAIL_USER', 'Docroldsllc@gmail.com'),
      appPass: optionalEnv('EMAIL_APP_PASS', ''),
    },

    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: optionalEnv('SENDGRID_FROM_EMAIL', 'noreply@docrolds.com'),
      fromName: optionalEnv('SENDGRID_FROM_NAME', 'Doc Rolds'),
    },

    brevo: {
      apiKey: process.env.BREVO_API_KEY,
      fromEmail: optionalEnv('BREVO_FROM_EMAIL', 'info@docrolds.com'),
      fromName: optionalEnv('BREVO_FROM_NAME', 'Doc Rolds'),
    },

    r2: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucketName: process.env.R2_BUCKET_NAME,
    },

    frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),
    downloadLinkExpiryDays: optionalIntEnv('DOWNLOAD_LINK_EXPIRY_DAYS', 7),
    sentryDsn: process.env.SENTRY_DSN,
  };
}

/**
 * Warn about insecure defaults in production
 */
function warnInsecureDefaults(config: Config): void {
  if (config.nodeEnv === 'production') {
    const warnings: string[] = [];

    if (!config.brevo.apiKey && !config.sendgrid.apiKey && !config.email.appPass) {
      warnings.push('No email provider configured (BREVO_API_KEY, SENDGRID_API_KEY, or EMAIL_APP_PASS) - emails will fail to send');
    }

    if (!config.square.webhookSignatureKey) {
      warnings.push('SQUARE_WEBHOOK_SIGNATURE_KEY is not set (webhook signature verification disabled)');
    }

    if (!config.sentryDsn) {
      warnings.push('SENTRY_DSN is not set (uncaught exceptions and payment/email failures will only be visible in logs)');
    }

    if (!config.r2.accountId || !config.r2.accessKeyId || !config.r2.secretAccessKey || !config.r2.bucketName) {
      warnings.push('R2 storage is not fully configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) - stems uploads will fail');
    }

    if (warnings.length > 0) {
      console.warn(
        `[CONFIG] Production security warnings:\n` +
        warnings.map(w => `  - ${w}`).join('\n')
      );
    }
  }
}

// Build and validate configuration on module load
export const config: Config = buildConfig();

// Warn about insecure defaults
warnInsecureDefaults(config);

// Log successful configuration load
console.log(`[CONFIG] Configuration loaded successfully`);
console.log(`[CONFIG] Environment: ${config.nodeEnv}`);
console.log(`[CONFIG] Port: ${config.port}`);
console.log(`[CONFIG] Square environment: ${config.square.environment}`);
console.log(`[CONFIG] Brevo enabled: ${!!config.brevo.apiKey}`);
console.log(`[CONFIG] SendGrid enabled: ${!!config.sendgrid.apiKey}`);

// Export individual config sections for convenience
export const { database, auth, square, email, sendgrid, brevo } = config;
export const sentryDsn = config.sentryDsn;

// Export type for use in other modules
export type { Config, DatabaseConfig, AuthConfig, SquareConfig, EmailConfig, SendGridConfig, BrevoConfig, R2Config };
