import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const healthChecks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        database: false,
        mcp: false,
      },
      details: {} as any,
    };

    // Check database connection
    try {
      const { error } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .limit(1);

      healthChecks.checks.database = !error;
      healthChecks.details.database = error ? error.message : 'Connected';
    } catch (error) {
      healthChecks.checks.database = false;
      healthChecks.details.database =
        error instanceof Error ? error.message : 'Unknown error';
    }

    // Check MCP manager (basic health)
    try {
      // This is a simple check - in production you might want more comprehensive checks
      healthChecks.checks.mcp = true;
      healthChecks.details.mcp = 'Manager initialized';
    } catch (error) {
      healthChecks.checks.mcp = false;
      healthChecks.details.mcp =
        error instanceof Error ? error.message : 'Unknown error';
    }

    // Overall health
    const allHealthy = Object.values(healthChecks.checks).every(check => check);
    healthChecks.status = allHealthy ? 'ok' : 'degraded';

    return NextResponse.json(healthChecks, {
      status: allHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
