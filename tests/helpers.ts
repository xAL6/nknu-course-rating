import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Sign a GoTrue-shaped user access token with the project's JWT secret. Lets
 * integration tests act as a logged-in user WITHOUT the email/password provider
 * (which is disabled — Google-only). RLS reads sub/email straight from this JWT.
 */
export function signUserJwt(userId: string, email: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("SUPABASE_JWT_SECRET missing");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ aud: "authenticated", role: "authenticated", sub: userId, email, iat: now, exp: now + 3600 }),
  );
  const sig = b64url(createHmac("sha256", secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

/** A Supabase client that makes requests as the given user (RLS-enforced). */
export function userClientFor(url: string, anon: string, userId: string, email: string): SupabaseClient {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${signUserJwt(userId, email)}` } },
  });
}
