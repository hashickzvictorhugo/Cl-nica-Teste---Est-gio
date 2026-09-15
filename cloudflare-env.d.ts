declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_TOKEN?: string;
    DEMO_ADMIN_TOKEN?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    ADMIN_ALLOWED_EMAILS?: string;
    REQUIRE_CF_ACCESS_FOR_ADMIN?: string;
    BOOKING_RATE_LIMITER?: {
      limit(input: { key: string }): Promise<{ success: boolean }>;
    };
    PUBLIC_READ_RATE_LIMITER?: {
      limit(input: { key: string }): Promise<{ success: boolean }>;
    };
    ADMIN_RATE_LIMITER?: {
      limit(input: { key: string }): Promise<{ success: boolean }>;
    };
  }
}
