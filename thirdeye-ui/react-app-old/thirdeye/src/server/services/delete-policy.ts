import { PrismaClient, UserStatus } from '@prisma/client';

export interface DeletePolicyOptions {
  anonymizeData?: boolean;
  cascadeDelete?: boolean;
  preserveAuditLogs?: boolean;
}

export interface DeleteResult {
  deletedRecords: {
    user: boolean;
    refreshTokens: number;
    verificationTokens: number;
    oauthConnections: number;
    userSessions: number;
    auditLogs: number;
  };
  anonymizedRecords?: {
    userData: boolean;
  };
}

/**
 * Service for handling user account deletion with configurable policies
 */
export class DeletePolicyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Delete a user account and all associated data according to the specified policy
   */
  async deleteUserAccount(
    userId: string, 
    options: DeletePolicyOptions = {}
  ): Promise<DeleteResult> {
    const {
      anonymizeData = false,
      cascadeDelete = true,
      preserveAuditLogs = false
    } = options;

    const result: DeleteResult = {
      deletedRecords: {
        user: false,
        refreshTokens: 0,
        verificationTokens: 0,
        oauthConnections: 0,
        userSessions: 0,
        auditLogs: 0
      }
    };

    // Use transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete refresh tokens
      const refreshTokenResult = await tx.refreshToken.deleteMany({
        where: { userId }
      });
      result.deletedRecords.refreshTokens = refreshTokenResult.count;

      // 2. Delete verification tokens
      const verificationTokenResult = await tx.verificationToken.deleteMany({
        where: { userId }
      });
      result.deletedRecords.verificationTokens = verificationTokenResult.count;

      // 3. Delete OAuth connections (if any)
      const oauthResult = await tx.oAuthAccount.deleteMany({
        where: { userId }
      });
      result.deletedRecords.oauthConnections = oauthResult.count;

      // 4. Delete user sessions (if any) - Note: UserSession model doesn't exist in schema
      // const sessionResult = await tx.userSession.deleteMany({
      //   where: { userId }
      // });
      // result.deletedRecords.userSessions = sessionResult.count;

      // 5. Handle audit logs
      if (!preserveAuditLogs) {
        const auditResult = await tx.auditLog.deleteMany({
          where: { userId }
        });
        result.deletedRecords.auditLogs = auditResult.count;
      }

      // 6. Handle user data based on policy
      if (anonymizeData) {
        // Anonymize user data instead of deleting
        await tx.user.update({
          where: { id: userId },
          data: {
            email: `deleted_${userId}@deleted.local`,
            name: 'Deleted User',
            passwordHash: null,
            status: UserStatus.DELETED,
            deletedAt: new Date(),
            // Clear sensitive data
            lastLoginAt: null,
            lastLoginIp: null,
            twoFactorEnabled: false,
            emailVerified: false
          }
        });
        result.anonymizedRecords = { userData: true };
      } else if (cascadeDelete) {
        // Hard delete the user (this will cascade to related records with foreign keys)
        await tx.user.delete({
          where: { id: userId }
        });
        result.deletedRecords.user = true;
      }
    });

    return result;
  }

  /**
   * Check if user has any critical data that should prevent deletion
   */
  async hasCriticalData(userId: string): Promise<{
    hasData: boolean;
    dataTypes: string[];
  }> {
    const dataTypes: string[] = [];

    // Check for active sessions - Note: UserSession model doesn't exist in schema
    // const activeSessions = await this.prisma.userSession.count({
    //   where: { 
    //     userId,
    //     expiresAt: { gt: new Date() }
    //   }
    // });

    // if (activeSessions > 0) {
    //   dataTypes.push(`${activeSessions} active session(s)`);
    // }

    // Check for pending verification tokens
    const pendingVerifications = await this.prisma.verificationToken.count({
      where: { 
        userId,
        verifiedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (pendingVerifications > 0) {
      dataTypes.push(`${pendingVerifications} pending verification(s)`);
    }

    // Check for OAuth connections
    const oauthConnections = await this.prisma.oAuthAccount.count({
      where: { userId }
    });

    if (oauthConnections > 0) {
      dataTypes.push(`${oauthConnections} OAuth connection(s)`);
    }

    return {
      hasData: dataTypes.length > 0,
      dataTypes
    };
  }

  /**
   * Soft delete user account (mark as deleted but keep data for recovery)
   */
  async softDeleteUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.DELETED,
        deletedAt: new Date(),
        // Keep all other data intact for potential recovery
      }
    });
  }

  /**
   * Restore a soft-deleted user account
   */
  async restoreUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        deletedAt: null
      }
    });
  }

  /**
   * Get deletion statistics for monitoring
   */
  async getDeletionStats(): Promise<{
    totalDeleted: number;
    deletedToday: number;
    deletedThisWeek: number;
    deletedThisMonth: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalDeleted, deletedToday, deletedThisWeek, deletedThisMonth] = await Promise.all([
      this.prisma.user.count({
        where: { 
          OR: [
            { status: UserStatus.DELETED },
            { deletedAt: { not: null } }
          ]
        }
      }),
      this.prisma.user.count({
        where: { 
          deletedAt: { gte: today }
        }
      }),
      this.prisma.user.count({
        where: { 
          deletedAt: { gte: weekAgo }
        }
      }),
      this.prisma.user.count({
        where: { 
          deletedAt: { gte: monthAgo }
        }
      })
    ]);

    return {
      totalDeleted,
      deletedToday,
      deletedThisWeek,
      deletedThisMonth
    };
  }
}

// Export singleton instance
export const deletePolicyService = new DeletePolicyService(require('../../lib/prisma').prisma);
