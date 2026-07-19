/**
 * Beats Routes
 * Handles all beat-related API endpoints including:
 * - Beat listing and retrieval
 * - Beat CRUD operations (admin)
 * - Beat likes and saves
 * - Beat comments and comment likes
 * - Playlist management
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as mm from 'music-metadata';
import { PrismaClient } from '@prisma/client';
import {
  authenticateToken,
  requireAdmin,
  authenticateCustomer,
  optionalCustomerAuth,
} from '../middleware';
import { asyncHandler, BadRequestError, NotFoundError, ConflictError } from '../middleware';
import { getLicensePricing } from '../services/pricing';
import { hasKnownFileSignatureFile, sanitizeFilename } from '../utils/fileValidation';
import type {
  AuthenticatedCustomerRequest,
  OptionalCustomerRequest,
  CreateBeatRequest,
  UpdateBeatRequest,
  LikeResponse,
  CreateCommentRequest,
  Beat,
} from '../types';

/**
 * Helper to safely parse query string parameter
 * Express query params can be string | string[] | undefined
 * Exported for use in other routes
 */
export function parseQueryString(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) {
    return param[0];
  }
  return param;
}

/**
 * Helper to safely parse route parameter to string
 * Express route params can be string | string[] in some TypeScript configurations
 */
function parseRouteParam(param: string | string[]): string {
  if (Array.isArray(param)) {
    return param[0];
  }
  return param;
}

const router = Router();
const prisma = new PrismaClient();

// ===========================================
// FILE UPLOAD CONFIGURATION
// ===========================================

/**
 * Parses an admin-submitted beat price. Returns null if not provided
 * (falls back to default $50/$150 tiers - see services/pricing.ts), or
 * throws if provided but not a finite positive number, so a typo or
 * malformed value can't silently become NaN/zero in the database.
 */
function parseBeatPrice(price: unknown): number | null {
  if (price === undefined || price === null || price === '') {
    return null;
  }
  const parsed = parseFloat(String(price));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestError('Price must be a positive number');
  }
  return parsed;
}

// Ensure upload directories exist before any upload is attempted. On a
// fresh deploy 'uploads/' is gitignored and otherwise only ever created
// as an incidental side effect of the first cover-art upload, so a
// plain audio-only upload (no cover art) would fail until then.
for (const dir of ['uploads/', 'uploads/covers/']) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Disk storage configuration for audio files and cover art
 */
const diskStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    let uploadDir = 'uploads/';

    if (file.mimetype.startsWith('audio/')) {
      uploadDir = 'uploads/';
    } else if (file.mimetype.startsWith('image/')) {
      uploadDir = 'uploads/covers/';
    }

    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    cb(null, Date.now() + '-' + sanitizeFilename(file.originalname));
  },
});

/**
 * Multer configuration for beat file uploads
 */
const uploadBeats = multer({
  storage: diskStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file (covers uncompressed WAV masters)
  },
  fileFilter: (_req, file, cb) => {
    const allowedAudio = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'];
    const allowedImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (allowedAudio.includes(file.mimetype) || allowedImage.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

/**
 * Verifies every disk-written file in a multer `.fields()` upload against
 * its magic bytes, deleting and rejecting the request if any file's actual
 * content doesn't match a known signature for the accepted formats.
 */
function verifyUploadedFileSignatures(
  files: { [fieldname: string]: Express.Multer.File[] } | undefined
): void {
  if (!files) return;
  const allFiles = Object.values(files).flat();
  for (const file of allFiles) {
    if (!hasKnownFileSignatureFile(file.path)) {
      // Clean up every file from this request, not just the offending one,
      // so a rejected upload doesn't leave orphaned files on disk.
      for (const f of allFiles) {
        fs.unlink(f.path, () => {});
      }
      throw new BadRequestError(
        `Uploaded file "${file.originalname}" does not match its declared file type`
      );
    }
  }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Extract audio duration from a file
 * @param filePath - Path to the audio file (relative to __dirname)
 * @returns Duration in seconds or null if extraction fails
 */
async function getAudioDuration(filePath: string): Promise<number | null> {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const metadata = await mm.parseFile(fullPath);
    return Math.round(metadata.format.duration || 0);
  } catch (error) {
    console.error('[AUDIO DURATION] Error extracting duration:', (error as Error).message);
    return null;
  }
}

/**
 * Process cover art image - resize and optimize for web
 * @param uploadPath - Path to the uploaded image
 * @returns Processed file path
 */
async function processCoverArt(uploadPath: string): Promise<string> {
  try {
    const fullPath = path.join(process.cwd(), uploadPath);
    const outputDir = path.dirname(fullPath);
    const filename = path.basename(fullPath, path.extname(fullPath));
    const outputPath = path.join(outputDir, `${filename}-processed.webp`);

    await sharp(fullPath)
      .resize(800, 800, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toFile(outputPath);

    // Remove original file
    fs.unlinkSync(fullPath);

    // Return the relative path
    return outputPath.replace(process.cwd(), '').replace(/\\/g, '/');
  } catch (error) {
    console.error('[COVER ART] Error processing cover art:', (error as Error).message);
    // Return original path if processing fails
    return uploadPath;
  }
}

/**
 * Mock beats for development/empty database
 */
const mockBeats: Partial<Beat>[] = [
  { title: 'Midnight Vibes', genre: 'Hip-Hop', category: 'Hip-Hop', bpm: 92, key: 'C Minor', duration: 165 },
  { title: 'Bass Trap', genre: 'Trap', category: 'Trap', bpm: 140, key: 'A Minor', duration: 180 },
  { title: 'Smooth Flows', genre: 'R&B', category: 'R&B', bpm: 95, key: 'F Major', duration: 200 },
  { title: 'Electric Dreams', genre: 'Pop', category: 'Pop', bpm: 120, key: 'G Major', duration: 210 },
];

// ===========================================
// BEAT LISTING AND RETRIEVAL
// ===========================================

/**
 * GET /api/beats
 * Get all beats with like and comment counts
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const beats = await prisma.beat.findMany({
      include: {
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    if (beats.length === 0) {
      res.json(mockBeats);
      return;
    }

    // Transform _count to likeCount and commentCount for easier frontend usage
    const beatsWithCounts = beats.map((beat) => ({
      ...beat,
      likeCount: beat._count.likes,
      commentCount: beat._count.comments,
      _count: undefined,
      licensePricing: getLicensePricing(beat),
    }));

    res.json(beatsWithCounts);
  })
);

/**
 * GET /api/beats/:id
 * Get a single beat by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const beatId = parseRouteParam(req.params.id);
    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      include: {
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    if (!beat) {
      throw new NotFoundError('Beat not found');
    }

    res.json({
      ...beat,
      likeCount: beat._count.likes,
      commentCount: beat._count.comments,
      _count: undefined,
      licensePricing: getLicensePricing(beat),
    });
  })
);

// ===========================================
// BEAT CRUD OPERATIONS (ADMIN)
// ===========================================

/**
 * POST /api/beats
 * Create a new beat (admin only)
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  uploadBeats.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'wavFile', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 },
  ]),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { title, genre, category, bpm, key, duration, price, producedBy, soldExclusively, soldExclusivelyTo } =
      req.body as CreateBeatRequest & { soldExclusively?: string; soldExclusivelyTo?: string };

    console.log('[BEAT CREATE] Received data:', {
      title,
      genre,
      category,
      bpm,
      key,
      duration,
      price,
      producedBy,
      soldExclusively,
      soldExclusivelyTo,
    });

    let audioFile: string | null = null;
    let wavFile: string | null = null;
    let coverArt: string | null = null;
    let extractedDuration = duration ? parseInt(String(duration)) : null;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    verifyUploadedFileSignatures(files);

    if (files) {
      // Handle MP3 preview file
      if (files.audioFile && files.audioFile[0]) {
        audioFile = `/uploads/${files.audioFile[0].filename}`;

        // Auto-extract duration from audio file if not provided
        if (!extractedDuration) {
          extractedDuration = await getAudioDuration(audioFile);
          console.log('[BEAT CREATE] Auto-extracted duration:', extractedDuration, 'seconds');
        }
      }

      // Handle WAV file
      if (files.wavFile && files.wavFile[0]) {
        wavFile = `/uploads/${files.wavFile[0].filename}`;

        // If no duration yet, try to extract from WAV file
        if (!extractedDuration) {
          extractedDuration = await getAudioDuration(wavFile);
          console.log('[BEAT CREATE] Auto-extracted duration from WAV:', extractedDuration, 'seconds');
        }
      }

      // Handle cover art
      if (files.coverArt && files.coverArt[0]) {
        const uploadPath = `uploads/covers/${files.coverArt[0].filename}`;
        const processedPath = await processCoverArt(uploadPath);
        coverArt = processedPath.replace(/\\/g, '/');
      }
    }

    const isSoldExclusively = soldExclusively === 'true' || String(soldExclusively) === 'true';

    const newBeat = await prisma.beat.create({
      data: {
        title,
        genre: genre || null,
        category: category || null,
        bpm: bpm ? parseInt(String(bpm)) : null,
        key: key || null,
        duration: extractedDuration,
        price: parseBeatPrice(price),
        producedBy: producedBy && producedBy.trim() ? producedBy.trim() : null,
        audioFile,
        wavFile,
        coverArt,
        soldExclusively: isSoldExclusively,
        soldExclusivelyAt: isSoldExclusively ? new Date() : null,
        soldExclusivelyTo: isSoldExclusively && soldExclusivelyTo ? soldExclusivelyTo.trim() : null,
      },
    });

    console.log('[BEAT CREATE] Created beat:', newBeat);
    res.status(201).json(newBeat);
  })
);

/**
 * PUT /api/beats/:id
 * Update a beat (admin only)
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  uploadBeats.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'wavFile', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 },
  ]),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { title, genre, category, bpm, key, duration, price, producedBy, soldExclusively, soldExclusivelyTo } =
      req.body as UpdateBeatRequest & { soldExclusively?: string; soldExclusivelyTo?: string };

    console.log('[BEAT UPDATE] Received data:', {
      title,
      genre,
      category,
      bpm,
      key,
      duration,
      price,
      producedBy,
      soldExclusively,
      soldExclusivelyTo,
    });

    const beatIdParam = parseRouteParam(req.params.id);
    const beat = await prisma.beat.findUnique({
      where: { id: beatIdParam },
    });

    if (!beat) {
      throw new NotFoundError('Beat not found');
    }

    const isSoldExclusively = soldExclusively === 'true' || String(soldExclusively) === 'true';
    const wasSoldExclusively = beat.soldExclusively;

    const updateData: Record<string, unknown> = {
      ...(title && { title }),
      ...(genre && { genre }),
      ...(category && { category }),
      ...(bpm && { bpm: parseInt(String(bpm)) }),
      ...(key && { key }),
      ...(duration && { duration: parseInt(String(duration)) }),
      ...(price && { price: parseBeatPrice(price) }),
      // Handle producedBy - allow empty string to clear, keep existing if undefined
      producedBy: producedBy !== undefined ? (producedBy.trim() || null) : beat.producedBy,
      // Handle soldExclusively fields
      soldExclusively: isSoldExclusively,
      soldExclusivelyAt:
        isSoldExclusively && !wasSoldExclusively
          ? new Date()
          : isSoldExclusively
          ? beat.soldExclusivelyAt
          : null,
      soldExclusivelyTo: isSoldExclusively
        ? (soldExclusivelyTo?.trim() || beat.soldExclusivelyTo)
        : null,
    };

    console.log('[BEAT UPDATE] Update data:', updateData);

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    verifyUploadedFileSignatures(files);

    if (files) {
      // Handle MP3 preview file
      if (files.audioFile && files.audioFile[0]) {
        updateData.audioFile = `/uploads/${files.audioFile[0].filename}`;

        // Auto-extract duration from new audio file if duration not manually provided
        if (!duration) {
          const extractedDuration = await getAudioDuration(updateData.audioFile as string);
          if (extractedDuration) {
            updateData.duration = extractedDuration;
            console.log('[BEAT UPDATE] Auto-extracted duration:', extractedDuration, 'seconds');
          }
        }
      }

      // Handle WAV file
      if (files.wavFile && files.wavFile[0]) {
        updateData.wavFile = `/uploads/${files.wavFile[0].filename}`;

        // If no duration yet and new WAV uploaded, extract from WAV
        if (!duration && !updateData.duration) {
          const extractedDuration = await getAudioDuration(updateData.wavFile as string);
          if (extractedDuration) {
            updateData.duration = extractedDuration;
            console.log('[BEAT UPDATE] Auto-extracted duration from WAV:', extractedDuration, 'seconds');
          }
        }
      }

      // Handle cover art
      if (files.coverArt && files.coverArt[0]) {
        const uploadPath = `uploads/covers/${files.coverArt[0].filename}`;
        const processedPath = await processCoverArt(uploadPath);
        updateData.coverArt = processedPath.replace(/\\/g, '/');
      }
    }

    const updatedBeat = await prisma.beat.update({
      where: { id: beatIdParam },
      data: updateData,
    });

    res.json(updatedBeat);
  })
);

/**
 * DELETE /api/beats/:id
 * Delete a beat (admin only)
 * Prevents deletion of purchased beats to preserve order history
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const beatId = parseRouteParam(req.params.id);

    // Check if beat exists and include orderItems for purchase check
    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      include: {
        orderItems: true,
      },
    });

    if (!beat) {
      throw new NotFoundError('Beat not found');
    }

    // Check if beat has been purchased - prevent deletion to preserve order history
    if (beat.orderItems && beat.orderItems.length > 0) {
      throw new BadRequestError(
        `Cannot delete this beat because it has been purchased (${beat.orderItems.length} order${
          beat.orderItems.length === 1 ? '' : 's'
        }). Consider hiding it instead.`
      );
    }

    // Delete related records first (likes, playlist entries, comments)
    // These have cascade delete but doing it explicitly for clarity
    await prisma.$transaction([
      prisma.beatLike.deleteMany({ where: { beatId } }),
      prisma.playlistBeat.deleteMany({ where: { beatId } }),
      prisma.comment.deleteMany({ where: { beatId } }),
      prisma.beat.delete({ where: { id: beatId } }),
    ]);

    res.json({ message: 'Beat deleted successfully' });
  })
);

// ===========================================
// BEAT LIKES
// ===========================================

/**
 * POST /api/beats/:id/like
 * Like a beat (requires customer authentication)
 */
router.post(
  '/:id/like',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const beatId = parseRouteParam(req.params.id);

    const existingLike = await prisma.beatLike.findUnique({
      where: {
        customerId_beatId: {
          customerId: authReq.customer.id,
          beatId,
        },
      },
    });

    if (existingLike) {
      throw new BadRequestError('Already liked');
    }

    await prisma.beatLike.create({
      data: {
        customerId: authReq.customer.id,
        beatId,
      },
    });

    const likeCount = await prisma.beatLike.count({
      where: { beatId },
    });

    res.json({ liked: true, likeCount } as LikeResponse);
  })
);

/**
 * DELETE /api/beats/:id/like
 * Unlike a beat (requires customer authentication)
 */
router.delete(
  '/:id/like',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const beatId = parseRouteParam(req.params.id);

    try {
      await prisma.beatLike.delete({
        where: {
          customerId_beatId: {
            customerId: authReq.customer.id,
            beatId,
          },
        },
      });
    } catch (error) {
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2025') {
        throw new NotFoundError('Like not found');
      }
      throw error;
    }

    const likeCount = await prisma.beatLike.count({
      where: { beatId },
    });

    res.json({ liked: false, likeCount } as LikeResponse);
  })
);

/**
 * GET /api/beats/:id/likes
 * Get like count and status for a beat
 * Optionally returns isLiked if customer is authenticated
 */
router.get(
  '/:id/likes',
  optionalCustomerAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const optReq = req as OptionalCustomerRequest;
    const beatId = parseRouteParam(req.params.id);

    const likeCount = await prisma.beatLike.count({
      where: { beatId },
    });

    let isLiked = false;
    if (optReq.customer) {
      const like = await prisma.beatLike.findUnique({
        where: {
          customerId_beatId: {
            customerId: optReq.customer.id,
            beatId,
          },
        },
      });
      isLiked = !!like;
    }

    res.json({ likeCount, isLiked });
  })
);

// ===========================================
// BEAT SAVES (PLAYLISTS)
// ===========================================

/**
 * POST /api/beats/:id/save
 * Save a beat to a playlist (requires customer authentication)
 * If no playlistId provided, saves to default "Saved Beats" playlist
 */
router.post(
  '/:id/save',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const { playlistId } = req.body as { playlistId?: string };
    const beatId = parseRouteParam(req.params.id);

    // If no playlist specified, use default
    let targetPlaylistId = playlistId;
    if (!targetPlaylistId) {
      const defaultPlaylist = await prisma.playlist.findFirst({
        where: {
          customerId: authReq.customer.id,
          isDefault: true,
        },
      });
      targetPlaylistId = defaultPlaylist?.id;

      if (!targetPlaylistId) {
        // Create default playlist if it doesn't exist
        const newDefault = await prisma.playlist.create({
          data: {
            customerId: authReq.customer.id,
            name: 'Saved Beats',
            isDefault: true,
          },
        });
        targetPlaylistId = newDefault.id;
      }
    }

    // Verify playlist belongs to customer
    const playlist = await prisma.playlist.findFirst({
      where: {
        id: targetPlaylistId,
        customerId: authReq.customer.id,
      },
    });

    if (!playlist) {
      throw new NotFoundError('Playlist not found');
    }

    // Check if already saved
    const existing = await prisma.playlistBeat.findUnique({
      where: {
        playlistId_beatId: {
          playlistId: targetPlaylistId,
          beatId,
        },
      },
    });

    if (existing) {
      throw new BadRequestError('Beat already in playlist');
    }

    await prisma.playlistBeat.create({
      data: {
        playlistId: targetPlaylistId,
        beatId,
      },
    });

    res.json({ saved: true, playlistId: targetPlaylistId });
  })
);

// ===========================================
// BEAT COMMENTS
// ===========================================

/**
 * GET /api/beats/:id/comments
 * Get all comments for a beat with replies
 */
router.get(
  '/:id/comments',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const beatId = parseRouteParam(req.params.id);

    // Get top-level comments only (no parentId)
    const comments = await prisma.comment.findMany({
      where: {
        beatId,
        isReported: false,
        parentId: null, // Only top-level comments
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            stageName: true,
            profilePicture: true,
          },
        },
        replies: {
          where: { isReported: false },
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                stageName: true,
                profilePicture: true,
              },
            },
            _count: {
              select: { likes: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { likes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to include likeCount - type the reply properly
    type ReplyWithCount = typeof comments[number]['replies'][number];
    const transformedComments = comments.map((comment) => ({
      ...comment,
      likeCount: comment._count.likes,
      _count: undefined,
      replies: comment.replies.map((reply: ReplyWithCount) => ({
        ...reply,
        likeCount: reply._count.likes,
        _count: undefined,
      })),
    }));

    res.json(transformedComments);
  })
);

/**
 * POST /api/beats/:id/comments
 * Add a comment to a beat (requires customer authentication)
 * Can be a reply if parentId is provided
 */
router.post(
  '/:id/comments',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const { content, parentId } = req.body as CreateCommentRequest;
    const beatId = parseRouteParam(req.params.id);

    if (!content || content.trim().length === 0) {
      throw new BadRequestError('Comment content is required');
    }

    if (content.length > 1000) {
      throw new BadRequestError('Comment too long (max 1000 characters)');
    }

    // If parentId is provided, verify it exists and belongs to this beat
    if (parentId) {
      const parentComment = await prisma.comment.findFirst({
        where: {
          id: parentId,
          beatId,
          parentId: null, // Can only reply to top-level comments
        },
      });
      if (!parentComment) {
        throw new BadRequestError('Invalid parent comment');
      }
    }

    const comment = await prisma.comment.create({
      data: {
        customerId: authReq.customer.id,
        beatId,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            stageName: true,
            profilePicture: true,
          },
        },
        _count: {
          select: { likes: true },
        },
      },
    });

    res.status(201).json({
      ...comment,
      likeCount: comment._count.likes,
      _count: undefined,
      replies: [],
    });
  })
);

/**
 * GET /api/beats/:id/comments/likes
 * Get list of comment IDs that the authenticated customer has liked for this beat
 */
router.get(
  '/:id/comments/likes',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const beatId = parseRouteParam(req.params.id);

    const likedComments = await prisma.commentLike.findMany({
      where: {
        customerId: authReq.customer.id,
        comment: {
          beatId,
        },
      },
      select: {
        commentId: true,
      },
    });

    res.json(likedComments.map((l) => l.commentId));
  })
);

// ===========================================
// COMMENT OPERATIONS (NON-BEAT-SPECIFIC)
// ===========================================

/**
 * DELETE /api/beats/comments/:id
 * Delete own comment (requires customer authentication)
 */
router.delete(
  '/comments/:id',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const commentId = parseRouteParam(req.params.id);

    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        customerId: authReq.customer.id,
      },
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    res.json({ message: 'Comment deleted' });
  })
);

/**
 * POST /api/beats/comments/:id/report
 * Report a comment (requires customer authentication)
 */
router.post(
  '/comments/:id/report',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const commentId = parseRouteParam(req.params.id);

    await prisma.comment.update({
      where: { id: commentId },
      data: {
        isReported: true,
        reportedAt: new Date(),
        reportedBy: authReq.customer.id,
      },
    });

    res.json({ message: 'Comment reported' });
  })
);

/**
 * POST /api/beats/comments/:id/like
 * Like a comment (requires customer authentication)
 */
router.post(
  '/comments/:id/like',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const commentId = parseRouteParam(req.params.id);

    // Check if comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Check if already liked
    const existingLike = await prisma.commentLike.findUnique({
      where: {
        customerId_commentId: {
          customerId: authReq.customer.id,
          commentId,
        },
      },
    });

    if (existingLike) {
      throw new ConflictError('Already liked');
    }

    await prisma.commentLike.create({
      data: {
        customerId: authReq.customer.id,
        commentId,
      },
    });

    // Get updated like count
    const likeCount = await prisma.commentLike.count({
      where: { commentId },
    });

    res.json({ liked: true, likeCount } as LikeResponse);
  })
);

/**
 * DELETE /api/beats/comments/:id/like
 * Unlike a comment (requires customer authentication)
 */
router.delete(
  '/comments/:id/like',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const commentId = parseRouteParam(req.params.id);

    await prisma.commentLike.deleteMany({
      where: {
        customerId: authReq.customer.id,
        commentId,
      },
    });

    // Get updated like count
    const likeCount = await prisma.commentLike.count({
      where: { commentId },
    });

    res.json({ liked: false, likeCount } as LikeResponse);
  })
);

// ===========================================
// PLAYLIST OPERATIONS
// ===========================================

/**
 * PUT /api/playlists/:id
 * Rename a playlist (requires customer authentication)
 */
router.put(
  '/playlists/:id',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const { name } = req.body as { name: string };
    const playlistId = parseRouteParam(req.params.id);

    const playlist = await prisma.playlist.findFirst({
      where: {
        id: playlistId,
        customerId: authReq.customer.id,
      },
    });

    if (!playlist) {
      throw new NotFoundError('Playlist not found');
    }

    if (playlist.isDefault) {
      throw new BadRequestError('Cannot rename default playlist');
    }

    const updated = await prisma.playlist.update({
      where: { id: playlistId },
      data: { name },
    });

    res.json(updated);
  })
);

/**
 * DELETE /api/playlists/:id
 * Delete a playlist (requires customer authentication)
 */
router.delete(
  '/playlists/:id',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const playlistId = parseRouteParam(req.params.id);

    const playlist = await prisma.playlist.findFirst({
      where: {
        id: playlistId,
        customerId: authReq.customer.id,
      },
    });

    if (!playlist) {
      throw new NotFoundError('Playlist not found');
    }

    if (playlist.isDefault) {
      throw new BadRequestError('Cannot delete default playlist');
    }

    await prisma.playlist.delete({
      where: { id: playlistId },
    });

    res.json({ message: 'Playlist deleted' });
  })
);

/**
 * DELETE /api/playlists/:playlistId/beats/:beatId
 * Remove a beat from a playlist (requires customer authentication)
 */
router.delete(
  '/playlists/:playlistId/beats/:beatId',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const playlistId = parseRouteParam(req.params.playlistId);
    const beatId = parseRouteParam(req.params.beatId);

    // Verify playlist belongs to customer
    const playlist = await prisma.playlist.findFirst({
      where: {
        id: playlistId,
        customerId: authReq.customer.id,
      },
    });

    if (!playlist) {
      throw new NotFoundError('Playlist not found');
    }

    try {
      await prisma.playlistBeat.delete({
        where: {
          playlistId_beatId: {
            playlistId,
            beatId,
          },
        },
      });
    } catch (error) {
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2025') {
        throw new NotFoundError('Beat not in playlist');
      }
      throw error;
    }

    res.json({ removed: true });
  })
);

export default router;
