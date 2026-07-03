/**
 * Shared email-sending service.
 * Sends via SendGrid when SENDGRID_API_KEY is configured (recommended -
 * SendGrid is built for transactional email and won't get rate-limited/
 * flagged the way Gmail SMTP can be). Falls back to Gmail SMTP via
 * nodemailer if only EMAIL_APP_PASS is set.
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

/**
 * Sends an email via whichever provider is configured. Throws on failure
 * (including "nothing configured") so callers can catch it, log it, and
 * record delivery failure - rather than silently swallowing it.
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  if (config.sendgrid.apiKey) {
    await sgMail.send({
      to,
      from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
      subject,
      html,
    });
    return;
  }

  if (config.email.appPass) {
    await gmailTransporter.sendMail({
      from: config.email.user,
      to,
      subject,
      html,
    });
    return;
  }

  throw new Error(
    'No email provider configured - set SENDGRID_API_KEY (recommended) or EMAIL_APP_PASS'
  );
}
