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

interface Config {
  port: number;
  nodeEnv: 'development' | 'production' | 'staging' | 'test';
  database: DatabaseConfig;
  auth: AuthConfig;
  square: SquareConfig;
  email: EmailConfig;
  sendgrid: SendGridConfig;
  frontendUrl: string;
  downloadLinkExpiryDays: number;
  cronSecret: string | undefined;
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

    frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),
    downloadLinkExpiryDays: optionalIntEnv('DOWNLOAD_LINK_EXPIRY_DAYS', 7),
    cronSecret: process.env.CRON_SECRET,
  };
}

/**
 * Warn about insecure defaults in production
 */
function warnInsecureDefaults(config: Config): void {
  if (config.nodeEnv === 'production') {
    const warnings: string[] = [];

    if (!config.email.appPass) {
      warnings.push('EMAIL_APP_PASS is not set (email sending may fail)');
    }

    if (!config.sendgrid.apiKey) {
      warnings.push('SENDGRID_API_KEY is not set (SendGrid email fallback unavailable)');
    }

    if (!config.cronSecret) {
      warnings.push('CRON_SECRET is not set (cron endpoints unprotected)');
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
console.log(`[CONFIG] SendGrid enabled: ${!!config.sendgrid.apiKey}`);

// Export individual config sections for convenience
export const { database, auth, square, email, sendgrid } = config;

// Export type for use in other modules
export type { Config, DatabaseConfig, AuthConfig, SquareConfig, EmailConfig, SendGridConfig };
