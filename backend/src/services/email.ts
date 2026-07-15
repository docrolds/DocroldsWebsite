/**
 * Shared email-sending service. Tries providers in this order:
 *
 *   1. Brevo (BREVO_API_KEY) - recommended. Free tier is 300 emails/day
 *      with no trial expiration, sent over HTTPS.
 *   2. SendGrid (SENDGRID_API_KEY) - also HTTPS-based, kept as a fallback
 *      in case Brevo has an outage or its free tier changes.
 *   3. Gmail SMTP via nodemailer (EMAIL_APP_PASS) - last resort only.
 *      Most cloud hosts (Render included) block outbound raw SMTP, so
 *      this reliably times out from production; it's only useful for
 *      local development where SMTP isn't blocked.
 */

import * as nodemailer from 'nodemailer';
import sgMail = require('@sendgrid/mail');
import { config } from '../config/env';

if (config.sendgrid.apiKey) {
  sgMail.setApiKey(config.sendgrid.apiKey);
}

const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.email.user,
    pass: config.email.appPass,
  },
});

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface BrevoErrorBody {
  code?: string;
  message?: string;
}

async function sendViaBrevo({ to, subject, html }: SendEmailOptions): Promise<void> {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.brevo.apiKey as string,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: config.brevo.fromEmail, name: config.brevo.fromName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as BrevoErrorBody;
    throw new Error(`Brevo: ${body.message || response.statusText || 'unknown error'}`);
  }
}

async function sendViaSendGrid({ to, subject, html }: SendEmailOptions): Promise<void> {
  try {
    await sgMail.send({
      to,
      from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
      subject,
      html,
    });
  } catch (error) {
    // The top-level error.message from @sendgrid/mail is often just a
    // generic HTTP status string (e.g. "Unauthorized") - the actually
    // useful reason lives in the response body. Surface it so callers'
    // error logs are actionable instead of just "Unauthorized".
    const sgError = error as {
      message?: string;
      response?: { body?: { errors?: Array<{ message?: string; field?: string; help?: string }> } };
    };
    const details = sgError.response?.body?.errors
      ?.map((e) => e.message)
      .filter(Boolean)
      .join('; ');
    throw new Error(
      details ? `SendGrid: ${details}` : `SendGrid: ${sgError.message || 'unknown error'}`
    );
  }
}

/**
 * Sends an email via whichever provider is configured. Throws on failure
 * (including "nothing configured") so callers can catch it, log it, and
 * record delivery failure - rather than silently swallowing it.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (config.brevo.apiKey) {
    return sendViaBrevo(options);
  }

  if (config.sendgrid.apiKey) {
    return sendViaSendGrid(options);
  }

  if (config.email.appPass) {
    await gmailTransporter.sendMail({
      from: config.email.user,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return;
  }

  throw new Error(
    'No email provider configured - set BREVO_API_KEY (recommended), SENDGRID_API_KEY, or EMAIL_APP_PASS'
  );
}
