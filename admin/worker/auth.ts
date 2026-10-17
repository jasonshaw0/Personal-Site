import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "./http.ts";

export type Identity = { email: string; sub: string; csrf: string };
export type AuthConfig = {
  APP_ORIGIN: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ADMIN_EMAIL: string;
};
const keySets = new Map<string, JWTVerifyGetKey>();
export async function verifyIdentity(
  request: Request,
  env: AuthConfig,
  resolver?: JWTVerifyGetKey,
): Promise<Identity> {
  if (new URL(request.url).origin !== env.APP_ORIGIN)
    throw new ApiError(403, "This hostname is not authorized.", "invalid_host");
  if (!env.ADMIN_EMAIL || !env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN)
    throw new ApiError(
      503,
      "Access configuration is incomplete.",
      "access_unconfigured",
    );
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || token.length > 16_384)
    throw new ApiError(
      401,
      "Sign in through Cloudflare Access.",
      "authentication_required",
    );
  try {
    let key = resolver ?? keySets.get(env.ACCESS_TEAM_DOMAIN);
    if (!key) {
      key = createRemoteJWKSet(
        new URL("/cdn-cgi/access/certs", env.ACCESS_TEAM_DOMAIN),
      );
      keySets.set(env.ACCESS_TEAM_DOMAIN, key);
    }
    const { payload } = await jwtVerify(token, key, {
      issuer: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "email"],
      clockTolerance: 5,
    });
    if (
      typeof payload.email !== "string" ||
      payload.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase() ||
      typeof payload.sub !== "string"
    )
      throw new Error("Unauthorized identity");
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token),
    );
    return {
      email: payload.email,
      sub: payload.sub,
      csrf: Buffer.from(digest).toString("base64url"),
    };
  } catch {
    throw new ApiError(
      401,
      "Your Access session is invalid or expired. Sign in again.",
      "invalid_session",
    );
  }
}
export function verifyMutation(
  request: Request,
  env: AuthConfig,
  identity: Identity,
) {
  if (
    request.headers.get("Origin") !== env.APP_ORIGIN ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    throw new ApiError(
      403,
      "Cross-origin changes are not allowed.",
      "csrf_rejected",
    );
  const received = Buffer.from(request.headers.get("X-CSRF-Token") ?? "");
  const expected = Buffer.from(identity.csrf);
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new ApiError(
      403,
      "Refresh this page before making changes.",
      "csrf_rejected",
    );
}
