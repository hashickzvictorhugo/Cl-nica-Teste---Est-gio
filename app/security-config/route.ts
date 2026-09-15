import { getTurnstileSiteKey, turnstileEnabled } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      turnstile: {
        enabled: turnstileEnabled(),
        siteKey: getTurnstileSiteKey(),
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
