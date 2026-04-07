/**
 * LLM Response Cache
 * 
 * Caches Anthropic API responses to reduce costs and improve latency.
 * Uses Supabase as the storage backend for persistence across instances.
 */

import { createClient } from "@supabase/supabase-js";

interface CacheEntry {
  id: string;
  prompt_hash: string;
  response: unknown;
  created_at: string;
  expires_at: string;
}

const CACHE_TTL_HOURS = 24; // Cache entries expire after 24 hours

async function hashPrompt(prompt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function getCachedResponse(promptHash: string): Promise<unknown | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn("[Cache] Supabase credentials not configured, skipping cache");
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("llm_cache")
      .select("response")
      .eq("prompt_hash", promptHash)
      .gt("expires_at", now)
      .single();

    if (error || !data) {
      return null;
    }

    console.log("[Cache] Hit for prompt hash:", promptHash.slice(0, 16));
    return data.response;
  } catch (err) {
    console.warn("[Cache] Error reading cache:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setCachedResponse(
  promptHash: string,
  response: unknown,
  ttlHours: number = CACHE_TTL_HOURS
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn("[Cache] Supabase credentials not configured, skipping cache write");
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    
    const { error } = await supabase.from("llm_cache").upsert({
      prompt_hash: promptHash,
      response,
      expires_at: expiresAt,
    });

    if (error) {
      console.warn("[Cache] Error writing cache:", error.message);
    } else {
      console.log("[Cache] Stored response for prompt hash:", promptHash.slice(0, 16));
    }
  } catch (err) {
    console.warn("[Cache] Error writing cache:", err instanceof Error ? err.message : err);
  }
}

export async function scanWithCache<T>(
  cacheKey: string,
  generateFn: () => Promise<T>
): Promise<T> {
  const promptHash = await hashPrompt(cacheKey);
  
  // Try cache first
  const cached = await getCachedResponse(promptHash);
  if (cached !== null) {
    return cached as T;
  }
  
  // Generate fresh response
  const result = await generateFn();
  
  // Store in cache
  await setCachedResponse(promptHash, result);
  
  return result;
}
