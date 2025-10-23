export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'CREATE_USER' | 'BULK_UPLOAD' | 'SEARCH_ORGANIZATION' | 'RATE_LIMIT_EXCEEDED' | 'VALIDATION_ERROR';
  userId?: string;  // From SSO when available
  clientId: string; // IP + User Agent hash
  details: {
    success: boolean;
    userCount?: number;
    organizationName?: string;
    errorMessage?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    contactId?: string;
    successCount?: number;
    failedCount?: number;
  };
  userAgent?: string;
}

// In-memory audit log storage (use database in production)
let auditLogs: AuditLogEntry[] = [];

export class AuditLogger {
  static log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    const auditEntry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    
    // Add to in-memory store
    auditLogs.unshift(auditEntry); // Add to beginning for chronological order
    
    // Keep only last 1000 entries in memory
    if (auditLogs.length > 1000) {
      auditLogs = auditLogs.slice(0, 1000);
    }
    
    // Log to console for development
    console.log('[AUDIT]', JSON.stringify(auditEntry));
    
    // In production: send to external logging service
    // await this.sendToExternalService(auditEntry);
  }

  static logUserCreation(
    clientId: string,
    createdUser: { firstName: string; lastName: string; email: string },
    organizationName: string,
    success: boolean,
    contactId?: string,
    errorMessage?: string,
    userId?: string,
    userAgent?: string
  ) {
    this.log({
      action: 'CREATE_USER',
      userId,
      clientId,
      userAgent,
      details: {
        success,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        email: createdUser.email,
        organizationName,
        contactId,
        errorMessage,
        userCount: 1,
      },
    });
  }

  static logBulkUpload(
    clientId: string,
    userCount: number,
    organizationName: string,
    successCount: number,
    failedCount: number,
    success: boolean,
    errorMessage?: string,
    userId?: string,
    userAgent?: string
  ) {
    this.log({
      action: 'BULK_UPLOAD',
      userId,
      clientId,
      userAgent,
      details: {
        success,
        userCount,
        organizationName,
        successCount,
        failedCount,
        errorMessage,
      },
    });
  }

  static logOrganizationSearch(
    clientId: string,
    searchTerm: string,
    matchCount: number,
    userId?: string,
    userAgent?: string
  ) {
    this.log({
      action: 'SEARCH_ORGANIZATION',
      userId,
      clientId,
      userAgent,
      details: {
        success: true,
        organizationName: searchTerm,
        userCount: matchCount,
      },
    });
  }

  static logRateLimitExceeded(
    clientId: string,
    action: string,
    userAgent?: string
  ) {
    this.log({
      action: 'RATE_LIMIT_EXCEEDED',
      clientId,
      userAgent,
      details: {
        success: false,
        errorMessage: `Rate limit exceeded for ${action}`,
      },
    });
  }

  static logValidationError(
    clientId: string,
    errors: string[],
    userAgent?: string
  ) {
    this.log({
      action: 'VALIDATION_ERROR',
      clientId,
      userAgent,
      details: {
        success: false,
        errorMessage: errors.join(', '),
      },
    });
  }

  // Get audit logs for admin interface
  static getAuditLogs(
    limit: number = 50,
    offset: number = 0,
    filter?: {
      action?: AuditLogEntry['action'];
      success?: boolean;
      clientId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): { logs: AuditLogEntry[]; total: number } {
    let filteredLogs = auditLogs;

    // Apply filters
    if (filter) {
      filteredLogs = auditLogs.filter(log => {
        if (filter.action && log.action !== filter.action) return false;
        if (filter.success !== undefined && log.details.success !== filter.success) return false;
        if (filter.clientId && log.clientId !== filter.clientId) return false;
        if (filter.startDate && log.timestamp < filter.startDate) return false;
        if (filter.endDate && log.timestamp > filter.endDate) return false;
        return true;
      });
    }

    const total = filteredLogs.length;
    const logs = filteredLogs.slice(offset, offset + limit);

    return { logs, total };
  }

  // Get audit statistics
  static getAuditStats(days: number = 7): {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    userCreations: number;
    bulkUploads: number;
    rateLimitViolations: number;
    topClients: Array<{ clientId: string; count: number }>;
  } {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffIso = cutoffDate.toISOString();

    const recentLogs = auditLogs.filter(log => log.timestamp >= cutoffIso);
    
    const clientCounts = new Map<string, number>();
    recentLogs.forEach(log => {
      clientCounts.set(log.clientId, (clientCounts.get(log.clientId) || 0) + 1);
    });

    const topClients = Array.from(clientCounts.entries())
      .map(([clientId, count]) => ({ clientId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalActions: recentLogs.length,
      successfulActions: recentLogs.filter(log => log.details.success).length,
      failedActions: recentLogs.filter(log => !log.details.success).length,
      userCreations: recentLogs.filter(log => log.action === 'CREATE_USER').length,
      bulkUploads: recentLogs.filter(log => log.action === 'BULK_UPLOAD').length,
      rateLimitViolations: recentLogs.filter(log => log.action === 'RATE_LIMIT_EXCEEDED').length,
      topClients,
    };
  }
}
