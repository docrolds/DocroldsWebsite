/**
 * API Request and Response Type Definitions
 * Types for API endpoints, requests, and responses
 */

import { Request } from 'express';
import type {
  Customer,
  Beat,
  Order,
  OrderItem,
  Playlist,
  Comment,
  Notification,
  PlaylistBeat,
} from './index';

// ===========================================
// GENERIC API RESPONSE TYPES
// ===========================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Paginated response for list endpoints
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  message: string;
  error?: string;
  statusCode?: number;
}

// ===========================================
// EXPRESS REQUEST EXTENSIONS
// ===========================================

/**
 * JWT payload for admin users
 */
export interface AdminJwtPayload {
  id: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT payload for customers
 */
export interface CustomerJwtPayload {
  id: string;
  email: string;
  impersonatedBy?: string; // Admin ID if impersonating
  iat?: number;
  exp?: number;
}

/**
 * Extended Express Request with authenticated admin user
 */
export interface AuthenticatedAdminRequest extends Request {
  user: AdminJwtPayload;
}

/**
 * Extended Express Request with authenticated customer
 */
export interface AuthenticatedCustomerRequest extends Request {
  customer: CustomerJwtPayload;
}

/**
 * Extended Express Request with optional customer (for endpoints that work with or without auth)
 */
export interface OptionalCustomerRequest extends Request {
  customer?: CustomerJwtPayload;
}

/**
 * Extended Express Request with both admin and customer possibilities
 */
export interface AuthenticatedRequest extends Request {
  user?: AdminJwtPayload;
  customer?: CustomerJwtPayload;
}

// ===========================================
// AUTH REQUEST/RESPONSE TYPES
// ===========================================

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

export interface CustomerRegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  stageName?: string;
  username?: string;
}

export interface CustomerLoginRequest {
  email: string;
  password: string;
}

export interface CustomerLoginResponse {
  token: string;
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    stageName: string | null;
    username: string | null;
    profilePicture: string | null;
    isGuest: boolean;
  };
}

export interface CustomerProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  stageName?: string;
  username?: string;
  phone?: string;
  profession?: string;
  dateOfBirth?: string;
  city?: string;
  state?: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

// ===========================================
// BEAT REQUEST/RESPONSE TYPES
// ===========================================

export interface CreateBeatRequest {
  title: string;
  genre?: string;
  category?: string;
  bpm?: number;
  key?: string;
  duration?: number;
  price?: number;
  producedBy?: string;
}

export interface UpdateBeatRequest extends Partial<CreateBeatRequest> {
  soldExclusively?: boolean;
  soldExclusivelyTo?: string;
}

export interface BeatWithLikeStatus extends Beat {
  likeCount: number;
  isLiked: boolean;
}

export interface BeatListResponse {
  beats: Beat[];
  total: number;
}

export interface BeatFilters {
  genre?: string;
  category?: string;
  minBpm?: number;
  maxBpm?: number;
  key?: string;
  producedBy?: string;
  search?: string;
  excludeSold?: boolean;
}

// ===========================================
// ORDER REQUEST/RESPONSE TYPES
// ===========================================

export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type LicenseType = 'STANDARD' | 'UNLIMITED';

export interface CartItem {
  beatId: string;
  licenseType: LicenseType;
}

export interface CreateCheckoutRequest {
  items: CartItem[];
  customerEmail: string;
  customerName?: string;
  isGuest?: boolean;
}

export interface CheckoutResponse {
  checkoutUrl: string;
  orderId: string;
  orderNumber: string;
}

export interface OrderWithItems extends Order {
  items: (OrderItem & {
    beat: Beat;
  })[];
  customer: Customer;
}

export interface OrderUpdateRequest {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  notes?: string;
  extendDownload?: boolean;
}

export interface OrderListFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// ===========================================
// DOWNLOAD REQUEST/RESPONSE TYPES
// ===========================================

export interface DownloadFileRequest {
  token: string;
  beatId: string;
  fileType: 'mp3' | 'wav';
}

export interface DownloadInfo {
  orderId: string;
  orderNumber: string;
  items: {
    beatId: string;
    beatTitle: string;
    licenseType: LicenseType;
    licenseName: string;
    hasWav: boolean;
    files: {
      type: 'mp3' | 'wav';
      filename: string;
      url: string;
    }[];
  }[];
  expiresAt: Date | null;
  downloadCount: number;
}

// ===========================================
// SOCIAL FEATURES REQUEST/RESPONSE TYPES
// ===========================================

// Likes
export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}

export interface LikedBeatsResponse {
  beats: Beat[];
}

// Playlists
export interface CreatePlaylistRequest {
  name: string;
}

export interface AddToPlaylistRequest {
  beatId: string;
  playlistId?: string; // If not provided, adds to default "Saved Beats" playlist
}

export interface PlaylistWithBeats extends Playlist {
  beats: (PlaylistBeat & {
    beat: Beat;
  })[];
}

// Comments
export interface CreateCommentRequest {
  content: string;
  parentId?: string; // For replies
}

export interface CommentWithReplies extends Comment {
  customer: {
    id: string;
    username: string | null;
    stageName: string | null;
    firstName: string | null;
    profilePicture: string | null;
  };
  replies: CommentWithReplies[];
  likeCount: number;
  isLiked?: boolean;
}

export interface BeatCommentsResponse {
  comments: CommentWithReplies[];
  total: number;
}

// ===========================================
// NOTIFICATION REQUEST/RESPONSE TYPES
// ===========================================

export type NotificationType =
  | 'ORDER_COMPLETED'
  | 'DOWNLOAD_READY'
  | 'DOWNLOAD_EXPIRING'
  | 'WELCOME';

export interface NotificationData {
  orderId?: string;
  orderNumber?: string;
  beatId?: string;
  beatTitle?: string;
  actionUrl?: string;
  [key: string]: unknown;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unreadCount: number;
}

export interface CreateNotificationRequest {
  customerId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
}

// ===========================================
// CUSTOMER MANAGEMENT (ADMIN) TYPES
// ===========================================

export interface CustomerListFilters {
  search?: string;
  isGuest?: boolean;
  isBlocked?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface BlockCustomerRequest {
  reason?: string;
}

export interface ImpersonateCustomerResponse {
  token: string;
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

// ===========================================
// CONTENT MANAGEMENT TYPES
// ===========================================

export interface PhotoUploadRequest {
  name: string;
  role?: string;
  credits?: string;
  placements?: string;
  category: string;
  description?: string;
  displayOnHome?: boolean;
}

export interface TeamMemberRequest {
  name: string;
  role: string;
  bio: string;
  photoUrl: string;
}

export interface ContentUpdateRequest {
  key: string;
  value: Record<string, unknown>;
}

// ===========================================
// ANALYTICS/STATS TYPES
// ===========================================

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalBeats: number;
  recentOrders: OrderWithItems[];
  topBeats: {
    beat: Beat;
    salesCount: number;
    revenue: number;
  }[];
}

export interface SalesAnalytics {
  period: 'day' | 'week' | 'month' | 'year';
  data: {
    date: string;
    orders: number;
    revenue: number;
  }[];
  totals: {
    orders: number;
    revenue: number;
  };
}

// ===========================================
// CRON/WEBHOOK TYPES
// ===========================================

export interface CronJobResponse {
  success: boolean;
  processed: number;
  notificationsSent: number;
  errors?: string[];
}

export interface SquareWebhookEvent {
  type: string;
  data: {
    type: string;
    id: string;
    object: Record<string, unknown>;
  };
}
