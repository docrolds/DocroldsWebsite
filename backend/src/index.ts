/**
 * Backend Server Entry Point
 * Starts the Express server and initializes the database
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from './app';
import { config } from './config/env';
import { sendPendingBookingReminders } from './routes/bookings';

const prisma = new PrismaClient();

/**
 * Initialize default admin user if not exists
 */
async function initializeDefaultData(): Promise<void> {
  try {
    console.log('[INIT] Checking for admin user...');
    console.log('[INIT] Admin username:', config.auth.adminUsername);

    const hashedPassword = await bcrypt.hash(config.auth.adminPassword, 12);

    const result = await prisma.user.upsert({
      where: { username: config.auth.adminUsername },
      update: {
        password: hashedPassword,
        email: config.auth.adminUsername
      },
      create: {
        username: config.auth.adminUsername,
        email: config.auth.adminUsername,
        password: hashedPassword,
        role: 'admin'
      }
    });

    console.log('[INIT] ✓ Default admin user configured, id:', result.id);
  } catch (error) {
    console.error('[INIT] Error initializing default data:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Run database migrations
 */
async function runMigrations(): Promise<void> {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('[MIGRATION] ✓ Database connected');
  } catch (error) {
    console.error('[MIGRATION] Database connection failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(): Promise<void> {
  console.log('\n[SHUTDOWN] Shutting down gracefully...');
  await prisma.$disconnect();
  console.log('[SHUTDOWN] Database disconnected');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    console.log('[STARTUP] Starting server initialization...');

    // Step 1: Run migrations/connect to database
    console.log('[STARTUP] Step 1: Connecting to database...');
    await runMigrations();

    // Step 2: Initialize default data
    console.log('[STARTUP] Step 2: Initializing default data...');
    await initializeDefaultData();

    // Step 3: Start listening
    app.listen(config.port, () => {
      console.log(`[STARTUP] ✓ Server running on http://localhost:${config.port}`);
      console.log(`[STARTUP] Environment: ${config.nodeEnv}`);
    });

    // Step 4: Start the booking-reminder sweep. Runs hourly while this
    // process is alive; the reminderSent flag makes it safe to call
    // repeatedly. If the web service ever sleeps between requests
    // (free/starter Render tier), reminders resume once it wakes - the
    // POST /api/bookings/send-reminders endpoint exists as a backup for
    // triggering it externally in the meantime.
    setInterval(() => {
      sendPendingBookingReminders().catch((error) => {
        console.error('[BOOKINGS] Reminder sweep failed:', error);
      });
    }, 60 * 60 * 1000);

  } catch (error) {
    console.error('[STARTUP] Server startup error:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
