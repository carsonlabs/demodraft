/**
 * Health Check API Endpoint
 * 
 * Provides comprehensive health status for monitoring and load balancers.
 * Checks database, external services, and system resources.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database?: {
      status: "ok" | "error";
      latencyMs?: number;
      error?: string;
    };
    anthropic?: {
      status: "ok" | "error";
      latencyMs?: number;
      error?: string;
    };
    stripe?: {
      status: "ok" | "error";
      latencyMs?: number;
      error?: string;
    };
    storage?: {
      status: "ok" | "error";
      latencyMs?: number;
      error?: string;
    };
  };
  uptime: number;
}

async function checkDatabase(): Promise<HealthStatus["checks"]["database"]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return { status: "error", error: "Supabase credentials not configured" };
  }

  const start = Date.now();
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Simple query to test connection
    const { error } = await supabase.from("campaigns").select("id").limit(1);
    
    if (error) {
      throw error;
    }
    
    return {
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkAnthropic(): Promise<HealthStatus["checks"]["anthropic"]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return { status: "error", error: "Anthropic API key not configured" };
  }

  const start = Date.now();
  try {
    // Lightweight check - just verify API key is valid
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    return {
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkStripe(): Promise<HealthStatus["checks"]["stripe"]> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    return { status: "error", error: "Stripe secret key not configured" };
  }

  const start = Date.now();
  try {
    const response = await fetch("https://api.stripe.com/v1/products", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    
    // Stripe returns 401/403 for invalid keys, but we just want to know if the service is reachable
    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid API key");
    }
    
    if (!response.ok && response.status !== 400) {
      throw new Error(`API returned ${response.status}`);
    }
    
    return {
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkStorage(): Promise<HealthStatus["checks"]["storage"]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return { status: "error", error: "Supabase credentials not configured" };
  }

  const start = Date.now();
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try to list buckets (minimal operation)
    const { error } = await supabase.storage.listBuckets();
    
    if (error) {
      throw error;
    }
    
    return {
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const detailed = searchParams.get("detailed") === "true";
  
  const startTime = Date.now();
  
  // Run all health checks in parallel
  const [database, anthropic, stripe, storage] = await Promise.all([
    checkDatabase(),
    detailed ? checkAnthropic() : Promise.resolve({ status: "ok" as const }),
    detailed ? checkStripe() : Promise.resolve({ status: "ok" as const }),
    checkStorage(),
  ]);

  // Determine overall health status
  const checks = { database, anthropic, stripe, storage };
  const errors = Object.values(checks).filter(c => c.status === "error");
  
  let status: HealthStatus["status"] = "healthy";
  if (errors.length > 0) {
    // Critical services: database and storage
    const criticalErrors = errors.filter((_, key) => 
      ["database", "storage"].includes(key)
    );
    status = criticalErrors.length > 0 ? "unhealthy" : "degraded";
  }

  const healthData: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "1.0.0",
    checks,
    uptime: process.uptime(),
  };

  // Add response time header
  const headers = new Headers();
  headers.set("X-Response-Time", `${Date.now() - startTime}ms`);
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

  return NextResponse.json(healthData, { 
    status: status === "healthy" ? 200 : status === "degraded" ? 200 : 503,
    headers,
  });
}
