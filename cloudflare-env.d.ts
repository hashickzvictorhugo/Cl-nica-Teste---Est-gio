declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_TOKEN?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    BOOKING_RATE_LIMITER?: {
      limit(input: { key: string }): Promise<{ success: boolean }>;
    };
  }
}
