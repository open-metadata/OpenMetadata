import { prisma } from '../../lib/prisma';
import { AuditStatus } from '@prisma/client';
import { logAudit, createLogger } from '../logger';

export interface AuditEvent {
  type: string;
  userId?: string;
  payload?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  resourceId?: string;
  resourceType?: string;
}

export interface AuthAuditEvent extends AuditEvent {
  type: 'SIGNUP' | 'SIGNIN_SUCCESS' | 'SIGNIN_FAILURE' | 'REFRESH_TOKEN' | 'LOGOUT' | 
        'VERIFY_EMAIL' | 'REQUEST_EMAIL_VERIFICATION' | 'RESET_PASSWORD' | 'REQUEST_PASSWORD_RESET' |
        'CHANGE_PASSWORD' | 'CHANGE_EMAIL' | 'LINK_OAUTH' | 'UNLINK_OAUTH' | 'DELETE_SELF' |
        'ADMIN_ROLE_CHANGE' | 'ADMIN_STATUS_CHANGE' | 'ADMIN_PASSWORD_RESET' | 'ENABLE_2FA' | 'DISABLE_2FA';
}

/**
 * Core audit logging function
 */
export async function log(
  type: string,
  userId?: string,
  payload?: Record<string, any>,
  context?: {
    ipAddress?: string;
    userAgent?: string;
    resourceId?: string;
    resourceType?: string;
  }
): Promise<void> {
  try {
    const auditData = {
      action: type,
      resource: context?.resourceType,
      resourceId: context?.resourceId,
      details: payload ? JSON.stringify(payload) : null,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      status: AuditStatus.SUCCESS,
      userId: userId || null
    };

    await prisma.auditLog.create({
      data: auditData
    });

    // Also log to application logger
    const logger = createLogger();
    if (userId) logger.setContext({ userId });
    logger.audit(type, {
      ...payload,
      resourceType: context?.resourceType,
      resourceId: context?.resourceId
    });

  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to avoid breaking the main operation
  }
}

/**
 * Log authentication events
 */
export async function logAuthEvent(
  event: AuthAuditEvent,
  context?: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  const payload = {
    ...event.payload,
    timestamp: new Date().toISOString()
  };

  await log(event.type, event.userId, payload, {
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    resourceType: 'USER',
    resourceId: event.userId
  });
}

/**
 * Log failed authentication attempt
 */
export async function logAuthFailure(
  type: 'SIGNIN_FAILURE' | 'VERIFY_EMAIL_FAILURE' | 'RESET_PASSWORD_FAILURE',
  email: string,
  reason: string,
  context?: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  try {
    const auditData = {
      action: type,
      resource: 'USER',
      resourceId: email, // Use email as identifier when user not found
      details: JSON.stringify({
        email,
        reason,
        timestamp: new Date().toISOString()
      }),
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      status: AuditStatus.FAILURE,
      userId: null
    };

    await prisma.auditLog.create({
      data: auditData
    });

    // Log security event
    logAudit(`AUTH_FAILURE: ${type}`, undefined, {
      email,
      reason,
      ipAddress: context?.ipAddress
    });

  } catch (error) {
    console.error('Failed to log auth failure:', error);
  }
}

/**
 * Log admin actions
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetUserId: string,
  details: Record<string, any>,
  context?: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await log(action, adminId, {
    targetUserId,
    ...details,
    timestamp: new Date().toISOString()
  }, {
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    resourceType: 'USER',
    resourceId: targetUserId
  });
}

/**
 * Log security events
 */
export async function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  context?: {
    ipAddress?: string;
    userAgent?: string;
    userId?: string;
  }
): Promise<void> {
  try {
    const auditData = {
      action: `SECURITY: ${event}`,
      resource: 'SYSTEM',
      details: JSON.stringify({
        ...details,
        timestamp: new Date().toISOString()
      }),
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      status: AuditStatus.SUCCESS,
      userId: context?.userId || null
    };

    await prisma.auditLog.create({
      data: auditData
    });

    // Log security event
    logAudit(`SECURITY: ${event}`, context?.userId, {
      ...details,
      ipAddress: context?.ipAddress
    });

  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

/**
 * Get audit logs for a user
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 50,
  offset: number = 0
) {
  return prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(
  resourceType: string,
  resourceId: string,
  limit: number = 50,
  offset: number = 0
) {
  return prisma.auditLog.findMany({
    where: {
      resource: resourceType,
      resourceId
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });
}

/**
 * Get security-related audit logs
 */
export async function getSecurityAuditLogs(
  limit: number = 100,
  offset: number = 0
) {
  return prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { startsWith: 'SECURITY:' } },
        { action: { contains: 'FAILURE' } },
        { status: AuditStatus.FAILURE }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });
}

/**
 * Clean up old audit logs (for maintenance)
 */
export async function cleanupOldAuditLogs(daysToKeep: number = 365): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate
      }
    }
  });

  console.log(`Cleaned up ${result.count} audit logs older than ${daysToKeep} days`);
  return result.count;
}

// Convenience functions for common audit events
export const audit = {
  signup: (userId: string, email: string, context?: any) =>
    logAuthEvent({ type: 'SIGNUP', userId, payload: { email } }, context),

  signinSuccess: (userId: string, email: string, context?: any) =>
    logAuthEvent({ type: 'SIGNIN_SUCCESS', userId, payload: { email } }, context),

  signinFailure: (email: string, reason: string, context?: any) =>
    logAuthFailure('SIGNIN_FAILURE', email, reason, context),

  refreshToken: (userId: string, context?: any) =>
    logAuthEvent({ type: 'REFRESH_TOKEN', userId }, context),

  logout: (userId: string, context?: any) =>
    logAuthEvent({ type: 'LOGOUT', userId }, context),

  verifyEmail: (userId: string, email: string, context?: any) =>
    logAuthEvent({ type: 'VERIFY_EMAIL', userId, payload: { email } }, context),

  verifyEmailFailure: (email: string, reason: string, context?: any) =>
    logAuthFailure('VERIFY_EMAIL_FAILURE', email, reason, context),

  requestEmailVerification: (userId: string, email: string, context?: any) =>
    logAuthEvent({ type: 'REQUEST_EMAIL_VERIFICATION', userId, payload: { email } }, context),

  resetPassword: (userId: string, email: string, context?: any) =>
    logAuthEvent({ type: 'RESET_PASSWORD', userId, payload: { email } }, context),

  requestPasswordReset: (email: string, context?: any) =>
    logAuthEvent({ type: 'REQUEST_PASSWORD_RESET', payload: { email } }, context),

  requestPasswordResetFailure: (email: string, reason: string, context?: any) =>
    logAuthFailure('RESET_PASSWORD_FAILURE', email, reason, context),

  changePassword: (userId: string, context?: any) =>
    logAuthEvent({ type: 'CHANGE_PASSWORD', userId }, context),

  changeEmail: (userId: string, oldEmail: string, newEmail: string, context?: any) =>
    logAuthEvent({ type: 'CHANGE_EMAIL', userId, payload: { oldEmail, newEmail } }, context),

  linkOAuth: (userId: string, provider: string, context?: any) =>
    logAuthEvent({ type: 'LINK_OAUTH', userId, payload: { provider } }, context),

  unlinkOAuth: (userId: string, provider: string, context?: any) =>
    logAuthEvent({ type: 'UNLINK_OAUTH', userId, payload: { provider } }, context),

  deleteSelf: (userId: string, email: string, context?: any) =>
    logAuthEvent({ type: 'DELETE_SELF', userId, payload: { email } }, context),

  enable2FA: (userId: string, context?: any) =>
    logAuthEvent({ type: 'ENABLE_2FA', userId }, context),

  disable2FA: (userId: string, context?: any) =>
    logAuthEvent({ type: 'DISABLE_2FA', userId }, context),

  adminRoleChange: (adminId: string, targetUserId: string, oldRole: string, newRole: string, reason: string, context?: any) =>
    logAdminAction(adminId, 'ADMIN_ROLE_CHANGE', targetUserId, { oldRole, newRole, reason }, context),

  adminStatusChange: (adminId: string, targetUserId: string, oldStatus: string, newStatus: string, reason: string, context?: any) =>
    logAdminAction(adminId, 'ADMIN_STATUS_CHANGE', targetUserId, { oldStatus, newStatus, reason }, context),

  adminPasswordReset: (adminId: string, targetUserId: string, targetEmail: string, reason: string, context?: any) =>
    logAdminAction(adminId, 'ADMIN_PASSWORD_RESET', targetUserId, { targetEmail, reason }, context)
};

export default audit;
