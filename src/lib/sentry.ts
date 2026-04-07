/**
 * Sentry Error Tracking Integration
 * 
 * Lightweight error tracking without requiring npm installation.
 * Uses direct HTTP API for minimal footprint.
 * 
 * To enable: Set SENTRY_DSN environment variable.
 */

interface SentryEvent {
  event_id: string;
  message: string;
  level: "fatal" | "error" | "warning" | "info" | "debug";
  platform: string;
  timestamp: number;
  extra?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
  };
  request?: {
    url?: string;
    method?: string;
  };
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename: string;
          function: string;
          lineno?: number;
          colno?: number;
        }>;
      };
    }>;
  };
}

let _dsn: string | null = null;
let _enabled = false;

function parseDSN(dsn: string): {
  publicKey: string;
  projectId: string;
  host: string;
} | null {
  try {
    const parts = dsn.split("://");
    if (parts.length !== 2) return null;
    
    const [protocol, rest] = parts;
    const [auth, path] = rest.split("@");
    const [publicKey] = auth.split(":");
    const projectId = path.split("/").pop() ?? "";
    const host = path.replace(`/${projectId}`, "").replace("//", "");
    
    return {
      publicKey,
      projectId,
      host: `${protocol}://${host}`,
    };
  } catch {
    return null;
  }
}

export function initSentry(dsn?: string): void {
  _dsn = dsn ?? process.env.SENTRY_DSN ?? null;
  _enabled = !!_dsn;
  
  if (_enabled) {
    console.log("[Sentry] Initialized with DSN:", _dsn?.slice(0, 20) + "...");
  }
}

function generateEventId(): string {
  return crypto.randomUUID();
}

export async function captureException(
  error: Error,
  context?: {
    userId?: string;
    userEmail?: string;
    requestUrl?: string;
    requestMethod?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): Promise<string | null> {
  if (!_enabled || !_dsn) {
    return null;
  }

  const config = parseDSN(_dsn);
  if (!config) {
    console.error("[Sentry] Invalid DSN format");
    return null;
  }

  const eventId = generateEventId();
  
  const event: SentryEvent = {
    event_id: eventId,
    message: error.message,
    level: "error",
    platform: "javascript",
    timestamp: Date.now() / 1000,
    extra: context?.extra,
    user: context?.userId || context?.userEmail ? {
      id: context.userId,
      email: context.userEmail,
    } : undefined,
    request: context?.requestUrl ? {
      url: context.requestUrl,
      method: context.requestMethod ?? "GET",
    } : undefined,
    exception: {
      values: [{
        type: error.name || "Error",
        value: error.message,
        stacktrace: error.stack ? {
          frames: error.stack.split("\n").slice(1, 10).map(line => {
            const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) || 
                         line.match(/at\s+(.+?):(\d+):(\d+)/);
            if (match) {
              return {
                filename: match[1] ?? "unknown",
                function: match[0] ? "anonymous" : undefined,
                lineno: parseInt(match[2] ?? "0", 10),
                colno: parseInt(match[3] ?? "0", 10),
              };
            }
            return {
              filename: "unknown",
              function: line.trim(),
            };
          }),
        } : undefined,
      }],
    },
  };

  try {
    const url = `${config.host}/api/${config.projectId}/envelope/`;
    const authHeader = `Sentry sentry_version=7,sentry_client=js-custom,sentry_key=${config.publicKey}`;
    
    const envelopeHeader = JSON.stringify({ event_id: eventId, dsn: _dsn });
    const itemHeader = JSON.stringify({ type: "event", content_type: "application/json" });
    const envelope = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`;
    
    await fetch(url, {
      method: "POST",
      headers: {
        "X-Sentry-Auth": authHeader,
        "Content-Type": "application/x-sentry-envelope",
      },
      body: envelope,
    });

    console.log(`[Sentry] Event captured: ${eventId}`);
    return eventId;
  } catch (err) {
    console.error("[Sentry] Failed to send event:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, unknown>
): Promise<string | null> {
  if (!_enabled || !_dsn) {
    return null;
  }

  const config = parseDSN(_dsn);
  if (!config) {
    return null;
  }

  const eventId = generateEventId();
  
  const event: SentryEvent = {
    event_id: eventId,
    message,
    level,
    platform: "javascript",
    timestamp: Date.now() / 1000,
    extra: context,
  };

  try {
    const url = `${config.host}/api/${config.projectId}/envelope/`;
    const authHeader = `Sentry sentry_version=7,sentry_client=js-custom,sentry_key=${config.publicKey}`;
    
    const envelopeHeader = JSON.stringify({ event_id: eventId, dsn: _dsn });
    const itemHeader = JSON.stringify({ type: "event", content_type: "application/json" });
    const envelope = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`;
    
    await fetch(url, {
      method: "POST",
      headers: {
        "X-Sentry-Auth": authHeader,
        "Content-Type": "application/x-sentry-envelope",
      },
      body: envelope,
    });

    return eventId;
  } catch (err) {
    console.error("[Sentry] Failed to send message:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options?: {
    captureRequestContext?: boolean;
  }
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      let context: Parameters<typeof captureException>[1] = {};
      
      if (options?.captureRequestContext && args.length > 0) {
        const firstArg = args[0];
        if (firstArg && typeof firstArg === "object" && "nextUrl" in firstArg) {
          const req = firstArg as { nextUrl?: { href?: string }; method?: string };
          context.requestUrl = req.nextUrl?.href;
          context.requestMethod = req.method;
        }
      }
      
      await captureException(err, context);
      throw error;
    }
  }) as T;
}

if (process.env.SENTRY_DSN) {
  initSentry();
}
