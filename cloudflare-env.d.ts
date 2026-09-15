declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_TOKEN?: string;
    BOOKING_RATE_LIMITER?: {
      limit(input: { key: string }): Promise<{ success: boolean }>;
    };
  }
}
