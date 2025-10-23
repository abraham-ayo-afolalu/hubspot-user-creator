import { NextRequest, NextResponse } from 'next/server';
import { AuditLogger } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action') || undefined;
    const success = searchParams.get('success');
    const clientId = searchParams.get('clientId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const filter: any = {};
    if (action) filter.action = action;
    if (success !== null && success !== '') filter.success = success === 'true';
    if (clientId) filter.clientId = clientId;
    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;

    const result = AuditLogger.getAuditLogs(limit, offset, filter);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
