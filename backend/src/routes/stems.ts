/**
 * Stems Routes
 * Handles the customer stems-upload feature for paid Mixing/Mastering
 * bookings: token-gated submission (reference-track/notes + audio files
 * uploaded to Cloudflare R2), with email notifications to both the
 * customer and admin.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, BadRequestError, NotFoundError, uploadLimiter } from '../middleware';
import { config } from '../config/env';
import { sendEmail } from '../services/email';
import { captureError } from '../services/sentry';
import { escapeHtml } from '../utils/text';
import { hasKnownFileSignatureBuffer, sanitizeFilename } from '../utils/fileValidation';
import { uploadToR2, isR2Configured } from '../services/storage';
import { isValidToken } from './bookings';

const router = Router();
const prisma = new PrismaClient();

const STEMS_ELIGIBLE_CATEGORIES = ['MIXING', 'MASTERING'];

// Memory storage - files are uploaded to R2, never written to local disk.
// Per-file/total limits are a conservative first pass (bounds worst-case
// memory use to ~1.2GB while multer buffers files before the R2 upload);
// raise these only alongside a larger Render plan or a move to streaming
// uploads if real sessions need bigger stem sets.
const uploadStems = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 60 * 1024 * 1024, // 60MB per file
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    const allowedAudio = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'];
    if (allowedAudio.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // A plain Error here falls through the error handler's generic
      // 500 branch (it only special-cases actual MulterError instances) -
      // throwing our own AppError subclass instead gets it classified and
      // returned as a proper 400.
      cb(new BadRequestError(`Invalid file type: ${file.mimetype}`));
    }
  },
});

function verifyStemFileSignatures(files: Express.Multer.File[]): void {
  for (const file of files) {
    if (!hasKnownFileSignatureBuffer(file.buffer)) {
      throw new BadRequestError(
        `Uploaded file "${file.originalname}" does not match its declared file type`
      );
    }
  }
}

// ===========================================
// EMAIL TEMPLATES
// ===========================================

interface StemBookingForEmail {
  bookingNumber: string;
  name: string;
  email: string;
}

interface StemSubmissionForEmail {
  songName: string;
  artistName: string;
  notes: string | null;
  files: string[];
}

async function sendStemsReceivedCustomerEmail(
  booking: StemBookingForEmail,
  submission: StemSubmissionForEmail
): Promise<void> {
  await sendEmail({
    to: booking.email,
    subject: `Stems received for #${booking.bookingNumber} - Doc Rolds Studio`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
        <h1 style="color: #E83628; text-align: center;">Stems Received!</h1>
        <p>Hey ${escapeHtml(booking.name)},</p>
        <p>We've received your stems for booking #${escapeHtml(booking.bookingNumber)}. Here's what you submitted:</p>
        <div style="background: #222; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; color: #fff;">
            <tr>
              <td style="padding: 8px 0; color: #999;">Song:</td>
              <td style="padding: 8px 0;"><strong>${escapeHtml(submission.songName)}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Artist:</td>
              <td style="padding: 8px 0;">${escapeHtml(submission.artistName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Files:</td>
              <td style="padding: 8px 0;">${submission.files.length} file${submission.files.length === 1 ? '' : 's'}</td>
            </tr>
          </table>
        </div>
        <p>We'll be in touch once your session is complete.</p>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">Doc Rolds Music</p>
      </div>
    `,
  });
}

async function sendStemsReceivedAdminEmail(
  booking: StemBookingForEmail,
  submission: StemSubmissionForEmail
): Promise<void> {
  await sendEmail({
    to: config.email.user,
    subject: `New stems submitted for #${booking.bookingNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
        <h1 style="color: #E83628; text-align: center;">New Stems Submission</h1>
        <div style="background: #222; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; color: #fff;">
            <tr>
              <td style="padding: 8px 0; color: #999;">Booking #:</td>
              <td style="padding: 8px 0;"><strong>${escapeHtml(booking.bookingNumber)}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Client:</td>
              <td style="padding: 8px 0;">${escapeHtml(booking.name)} (<a href="mailto:${encodeURIComponent(booking.email)}" style="color: #fff;">${escapeHtml(booking.email)}</a>)</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Song:</td>
              <td style="padding: 8px 0;">${escapeHtml(submission.songName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Artist:</td>
              <td style="padding: 8px 0;">${escapeHtml(submission.artistName)}</td>
            </tr>
            ${submission.notes ? `
            <tr>
              <td style="padding: 8px 0; color: #999;">Notes:</td>
              <td style="padding: 8px 0;">${escapeHtml(submission.notes)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: #999;">Files:</td>
              <td style="padding: 8px 0;">${submission.files.length} file${submission.files.length === 1 ? '' : 's'}</td>
            </tr>
          </table>
        </div>
        <p>View and download the files from the admin dashboard's Bookings section.</p>
      </div>
    `,
  });
}

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/stems/booking/:bookingNumber?key=<rescheduleToken>
 * Public, token-gated (reuses Booking.rescheduleToken as the "manage this
 * booking" secret). Returns booking summary + any existing submissions'
 * metadata, so the customer-facing page can show "already submitted" state.
 */
router.get(
  '/booking/:bookingNumber',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const bookingNumber = req.params.bookingNumber as string;
    const key = typeof req.query.key === 'string' ? req.query.key : undefined;

    if (!key) {
      throw new BadRequestError('Missing access key');
    }

    const booking = await prisma.booking.findUnique({
      where: { bookingNumber },
      select: {
        id: true,
        bookingNumber: true,
        rescheduleToken: true,
        name: true,
        category: true,
        stemSubmissions: {
          select: { id: true, songName: true, artistName: true, notes: true, createdAt: true, files: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!booking || !isValidToken(key, booking.rescheduleToken)) {
      throw new NotFoundError('Booking not found');
    }

    if (!STEMS_ELIGIBLE_CATEGORIES.includes(booking.category)) {
      throw new BadRequestError('Stems upload is only available for Mixing and Mastering bookings');
    }

    res.json({
      bookingNumber: booking.bookingNumber,
      name: booking.name,
      category: booking.category,
      submissions: booking.stemSubmissions.map((s) => ({
        id: s.id,
        songName: s.songName,
        artistName: s.artistName,
        notes: s.notes,
        fileCount: s.files.length,
        createdAt: s.createdAt,
      })),
    });
  })
);

/**
 * POST /api/stems/booking/:bookingNumber?key=<rescheduleToken>
 * Public, same token gate. Accepts songName/artistName/notes + up to 20
 * audio files, uploads them to R2, creates a StemSubmission, and fires
 * both notification emails fire-and-forget.
 */
router.post(
  '/booking/:bookingNumber',
  uploadLimiter,
  uploadStems.array('stems', 20),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!isR2Configured()) {
      throw new BadRequestError('Stems upload is temporarily unavailable - please contact us directly');
    }

    const bookingNumber = req.params.bookingNumber as string;
    const key = typeof req.query.key === 'string' ? req.query.key : undefined;

    if (!key) {
      throw new BadRequestError('Missing access key');
    }

    const booking = await prisma.booking.findUnique({
      where: { bookingNumber },
      select: { id: true, bookingNumber: true, rescheduleToken: true, name: true, email: true, category: true },
    });

    if (!booking || !isValidToken(key, booking.rescheduleToken)) {
      throw new NotFoundError('Booking not found');
    }

    if (!STEMS_ELIGIBLE_CATEGORIES.includes(booking.category)) {
      throw new BadRequestError('Stems upload is only available for Mixing and Mastering bookings');
    }

    const { songName, artistName, notes } = req.body as { songName?: string; artistName?: string; notes?: string };
    if (!songName?.trim() || !artistName?.trim()) {
      throw new BadRequestError('Song name and artist name are required');
    }

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length === 0) {
      throw new BadRequestError('At least one file is required');
    }

    verifyStemFileSignatures(files);

    const uploadedKeys: string[] = [];
    for (const file of files) {
      const objectKey = `stems/${booking.id}/${Date.now()}-${sanitizeFilename(file.originalname)}`;
      await uploadToR2(objectKey, file.buffer, file.mimetype);
      uploadedKeys.push(objectKey);
    }

    const submission = await prisma.stemSubmission.create({
      data: {
        bookingId: booking.id,
        songName: songName.trim(),
        artistName: artistName.trim(),
        notes: notes?.trim() || null,
        files: uploadedKeys,
      },
    });

    const emailData: StemSubmissionForEmail = {
      songName: submission.songName,
      artistName: submission.artistName,
      notes: submission.notes,
      files: submission.files,
    };

    sendStemsReceivedCustomerEmail(booking, emailData).catch((err) => {
      console.error('[STEMS] Failed to send customer confirmation email:', err);
      captureError(err, { context: 'sendStemsReceivedCustomerEmail', bookingId: booking.id });
    });
    sendStemsReceivedAdminEmail(booking, emailData).catch((err) => {
      console.error('[STEMS] Failed to send admin notification email:', err);
      captureError(err, { context: 'sendStemsReceivedAdminEmail', bookingId: booking.id });
    });

    res.status(201).json({
      id: submission.id,
      songName: submission.songName,
      artistName: submission.artistName,
      notes: submission.notes,
      fileCount: submission.files.length,
      createdAt: submission.createdAt,
    });
  })
);

export default router;
