// Data Lifecycle Management API Endpoints
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import { RBACService } from '@/lib/services/rbac-service';
import DataLifecycleService from '@/lib/services/data-lifecycle-service';
import SupabaseRepository from '@/lib/services/supabase-repository';

/**
 * GET /api/data-lifecycle
 * Get data lifecycle and retention information
 * GET /api/data-lifecycle/report
 * Get compliance and lifecycle report
 */
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isReportEndpoint = pathname.endsWith('/report');

  // Handle /report endpoint
  if (isReportEndpoint) {
    try {
      const auth = await getAuthContext(request);

      if (!auth.isAuthenticated) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);
      const credentialId = searchParams.get('credentialId');

      if (!credentialId) {
        return NextResponse.json(
          { success: false, error: 'Missing credentialId parameter' },
          { status: 400 }
        );
      }

      const lifecycle = await SupabaseRepository.getDataLifecycle(credentialId);
      const events = await SupabaseRepository.getLifecycleEvents(credentialId);

      if (!lifecycle) {
        return NextResponse.json(
          { success: false, error: 'Lifecycle data not found' },
          { status: 404 }
        );
      }

      const report = DataLifecycleService.generateComplianceReport(lifecycle, events);
      const deletionEligibility = DataLifecycleService.getDeletionEligibility(lifecycle, events);

      console.log('[v0] Compliance report generated:', {
        credentialId: credentialId.slice(0, 16),
        canDelete: deletionEligibility.canBeDeleted,
      });

      return NextResponse.json({
        success: true,
        data: {
          compliance: report,
          deletionEligibility,
        },
      });
    } catch (error) {
      console.error('[v0] Generate report error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to generate report' },
        { status: 500 }
      );
    }
  }

  // Handle general data-lifecycle endpoint
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes('data:read:own');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to read data lifecycle' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get('credentialId');

    if (credentialId) {
      const lifecycle = await SupabaseRepository.getDataLifecycle(credentialId);

      if (!lifecycle) {
        return NextResponse.json(
          { success: false, error: 'Lifecycle data not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: lifecycle,
      });
    }

    const allLifecycles = await SupabaseRepository.getUserDataLifecycles(auth.userId);

    console.log('[v0] Fetched data lifecycle records:', {
      userId: auth.userId,
      count: allLifecycles.length,
    });

    return NextResponse.json({
      success: true,
      data: allLifecycles,
    });
  } catch (error) {
    console.error('[v0] Get data lifecycle error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data lifecycle' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-lifecycle
 * Create data retention policy
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credentialId, retentionPolicy, retentionPeriodDays } = body;

    if (!credentialId || !retentionPolicy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: credentialId, retentionPolicy' },
        { status: 400 }
      );
    }

    // Create retention policy
    const retention = DataLifecycleService.createRetentionPolicy(
      credentialId,
      'credential',
      retentionPolicy,
      retentionPeriodDays
    );

    // Save to Supabase
    const saved = await SupabaseRepository.saveDataLifecycle(retention);

    console.log('[v0] Data retention policy created:', {
      credentialId: credentialId.slice(0, 16),
      retentionPolicy,
      retentionDays: retentionPeriodDays,
    });

    return NextResponse.json(
      {
        success: true,
        data: saved,
        message: 'Retention policy created',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Create retention policy error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create retention policy' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/data-lifecycle/record-event
 * Record a data lifecycle event
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credentialId, stage, action, metadata } = body;

    if (!credentialId || !stage || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: credentialId, stage, action' },
        { status: 400 }
      );
    }

    // Record lifecycle event
    const event = DataLifecycleService.recordLifecycleEvent(
      credentialId,
      stage,
      auth.userId,
      action,
      metadata
    );

    // Save to Supabase
    const saved = await SupabaseRepository.saveLifecycleEvent(event);

    console.log('[v0] Lifecycle event recorded:', {
      credentialId: credentialId.slice(0, 16),
      stage,
      action,
    });

    return NextResponse.json({
      success: true,
      data: saved,
      message: 'Lifecycle event recorded',
    });
  } catch (error) {
    console.error('[v0] Record lifecycle event error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record lifecycle event' },
      { status: 500 }
    );
  }
}
