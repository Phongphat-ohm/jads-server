import { prisma } from '../config/db';

export interface CreateFeedbackParams {
  userId?: string | null;
  type?: 'BUG' | 'FEATURE_REQUEST' | 'GENERAL_FEEDBACK' | 'TEMPLATE_ISSUE';
  rating?: number | null;
  title: string;
  description: string;
  screenshot?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  pageUrl?: string | null;
  appVersion?: string | null;
  contactInfo?: string | null;
}

export interface ListFeedbacksParams {
  userId?: string;
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class FeedbackService {
  /**
   * Submit a new feedback entry
   */
  async createFeedback(params: CreateFeedbackParams) {
    return await prisma.feedback.create({
      data: {
        userId: params.userId || null,
        type: (params.type as any) || 'GENERAL_FEEDBACK',
        rating: params.rating ? Math.min(5, Math.max(1, params.rating)) : null,
        title: params.title.trim(),
        description: params.description.trim(),
        screenshot: params.screenshot || null,
        attachmentUrl: params.attachmentUrl || null,
        attachmentName: params.attachmentName || null,
        pageUrl: params.pageUrl || null,
        appVersion: params.appVersion || null,
        contactInfo: params.contactInfo ? params.contactInfo.trim() : null,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            courtName: true,
          },
        },
      },
    });
  }

  /**
   * List feedback entries with pagination and filter
   */
  async listFeedbacks(params: ListFeedbacksParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.userId) where.userId = params.userId;
    if (params.type && params.type !== 'ALL') where.type = params.type;
    if (params.status && params.status !== 'ALL') where.status = params.status;
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.feedback.count({ where }),
      prisma.feedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              courtName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      items,
    };
  }

  /**
   * Get single feedback entry by ID
   */
  async getFeedbackById(id: string) {
    return await prisma.feedback.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            courtName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Update feedback status & admin note (Admin only)
   */
  async updateFeedbackStatus(id: string, status?: string, adminNote?: string) {
    const data: any = {};
    if (status) data.status = status;
    if (adminNote !== undefined) data.adminNote = adminNote;

    return await prisma.feedback.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            courtName: true,
          },
        },
      },
    });
  }

  /**
   * Delete a feedback entry (Admin only)
   */
  async deleteFeedback(id: string) {
    return await prisma.feedback.delete({
      where: { id },
    });
  }

  /**
   * Feedback statistics for Admin Dashboard
   */
  async getFeedbackStats() {
    const [total, pending, reviewed, inProgress, resolved, rejected] = await Promise.all([
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: 'PENDING' } }),
      prisma.feedback.count({ where: { status: 'REVIEWED' } }),
      prisma.feedback.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.feedback.count({ where: { status: 'RESOLVED' } }),
      prisma.feedback.count({ where: { status: 'REJECTED' } }),
    ]);

    return {
      total,
      pending,
      reviewed,
      inProgress,
      resolved,
      rejected,
    };
  }
}

export const feedbackService = new FeedbackService();
