/**
 * Backend Type Definitions
 * Central export file for all TypeScript types
 */

// ===========================================
// DATABASE MODEL TYPES
// Based on Prisma schema definitions
// ===========================================

/**
 * User (Admin) model
 * Represents admin users who manage the platform
 */
export interface User {
  id: string;
  username: string;
  email: string | null;
  password: string;
  role: string;
  createdAt: Date;
}

/**
 * User without sensitive data
 */
export type SafeUser = Omit<User, 'password'>;

/**
 * Customer model
 * Represents customers who purchase beats
 */
export interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  stageName: string | null;
  username: string | null;
  password: string | null;
  phone: string | null;
  profession: string | null;
  dateOfBirth: Date | null;
  city: string | null;
  state: string | null;
  profilePicture: string | null;
  isGuest: boolean;
  isBlocked: boolean;
  blockedAt: Date | null;
  blockedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Customer without sensitive data
 */
export type SafeCustomer = Omit<Customer, 'password'>;

/**
 * Customer with relations
 */
export interface CustomerWithRelations extends Customer {
  orders?: Order[];
  likes?: BeatLike[];
  playlists?: Playlist[];
  comments?: Comment[];
  commentLikes?: CommentLike[];
  notifications?: Notification[];
}

/**
 * Beat model
 * Represents a music beat available for purchase
 */
export interface Beat {
  id: string;
  title: string;
  genre: string | null;
  category: string | null;
  bpm: number | null;
  key: string | null;
  duration: number | null;
  price: number | null;
  producedBy: string | null;
  audioFile: string | null;
  wavFile: string | null;
  coverArt: string | null;
  createdAt: Date;
  soldExclusively: boolean;
  soldExclusivelyAt: Date | null;
  soldExclusivelyTo: string | null;
}

/**
 * Beat with relations
 */
export interface BeatWithRelations extends Beat {
  orderItems?: OrderItem[];
  likes?: BeatLike[];
  playlistBeats?: PlaylistBeat[];
  comments?: Comment[];
}

/**
 * Order model
 * Represents a customer's order
 */
export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  squarePaymentId: string | null;
  subtotal: number;
  total: number;
  downloadToken: string;
  downloadExpiresAt: Date | null;
  downloadCount: number;
  emailSent: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Order with relations
 */
export interface OrderWithRelations extends Order {
  customer?: Customer;
  items?: OrderItem[];
}

/**
 * OrderItem model
 * Represents an individual item within an order
 */
export interface OrderItem {
  id: string;
  orderId: string;
  beatId: string;
  licenseType: string;
  licenseName: string;
  price: number;
}

/**
 * OrderItem with relations
 */
export interface OrderItemWithRelations extends OrderItem {
  order?: Order;
  beat?: Beat;
}

/**
 * License tier type
 * Defines available license options
 */
export interface LicenseTier {
  type: 'STANDARD' | 'UNLIMITED';
  name: string;
  price: number;
  description?: string;
  features?: string[];
}

/**
 * Predefined license tiers
 */
export const LICENSE_TIERS: LicenseTier[] = [
  {
    type: 'STANDARD',
    name: 'Standard Lease',
    price: 50,
    description: 'MP3 only, limited distribution',
    features: [
      'MP3 file download',
      'Up to 5,000 streams',
      'Up to 2,500 downloads',
      'Non-exclusive rights',
    ],
  },
  {
    type: 'UNLIMITED',
    name: 'Unlimited Lease',
    price: 150,
    description: 'MP3 + WAV, unlimited distribution',
    features: [
      'MP3 + WAV file downloads',
      'Unlimited streams',
      'Unlimited downloads',
      'Non-exclusive rights',
      'Music video rights',
    ],
  },
];

/**
 * BeatLike model
 * Represents a customer's like on a beat
 */
export interface BeatLike {
  id: string;
  customerId: string;
  beatId: string;
  createdAt: Date;
}

/**
 * BeatLike with relations
 */
export interface BeatLikeWithRelations extends BeatLike {
  customer?: Customer;
  beat?: Beat;
}

/**
 * Playlist model
 * Represents a customer's playlist of beats
 */
export interface Playlist {
  id: string;
  customerId: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Playlist with relations
 */
export interface PlaylistWithRelations extends Playlist {
  customer?: Customer;
  beats?: PlaylistBeat[];
}

/**
 * PlaylistBeat model
 * Junction table for playlist-beat relationship
 */
export interface PlaylistBeat {
  id: string;
  playlistId: string;
  beatId: string;
  addedAt: Date;
}

/**
 * PlaylistBeat with relations
 */
export interface PlaylistBeatWithRelations extends PlaylistBeat {
  playlist?: Playlist;
  beat?: Beat;
}

/**
 * Comment model
 * Represents a customer's comment on a beat
 */
export interface Comment {
  id: string;
  customerId: string;
  beatId: string;
  content: string;
  isReported: boolean;
  reportedAt: Date | null;
  reportedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
}

/**
 * Comment with relations
 */
export interface CommentWithRelations extends Comment {
  customer?: Customer;
  beat?: Beat;
  parent?: Comment;
  replies?: Comment[];
  likes?: CommentLike[];
}

/**
 * CommentLike model
 * Represents a customer's like on a comment
 */
export interface CommentLike {
  id: string;
  customerId: string;
  commentId: string;
  createdAt: Date;
}

/**
 * CommentLike with relations
 */
export interface CommentLikeWithRelations extends CommentLike {
  customer?: Customer;
  comment?: Comment;
}

/**
 * Notification model
 * Represents a customer notification
 */
export interface Notification {
  id: string;
  customerId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Notification with relations
 */
export interface NotificationWithRelations extends Notification {
  customer?: Customer;
}

/**
 * DownloadLink type
 * Represents download information for an order
 */
export interface DownloadLink {
  orderId: string;
  orderNumber: string;
  downloadToken: string;
  downloadUrl: string;
  expiresAt: Date | null;
  downloadCount: number;
  items: {
    beatId: string;
    beatTitle: string;
    licenseType: string;
    licenseName: string;
    files: {
      type: 'mp3' | 'wav';
      filename: string;
      downloadUrl: string;
    }[];
  }[];
}

/**
 * Photo model
 * Represents photos for team/portfolio display
 */
export interface Photo {
  id: string;
  name: string;
  role: string | null;
  credits: string | null;
  placements: string | null;
  category: string;
  description: string | null;
  photoData: string | null;
  photoFile: string | null;
  mimeType: string | null;
  displayOnHome: boolean;
  createdAt: Date;
}

/**
 * Content model
 * Represents dynamic content stored in database
 */
export interface Content {
  id: string;
  key: string;
  value: Record<string, unknown>;
}

/**
 * TeamMember model
 * Represents a team member displayed on the site
 */
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photoUrl: string;
  createdAt: Date;
}

// ===========================================
// UTILITY TYPES
// ===========================================

/**
 * Make all properties in T optional except for K
 */
export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;

/**
 * Make specific properties in T required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Type for creating a new entity (without id and timestamps)
 */
export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Type for updating an entity (all fields optional except id)
 */
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>> & { id: string };

// ===========================================
// RE-EXPORT API TYPES
// ===========================================

export * from './api';
