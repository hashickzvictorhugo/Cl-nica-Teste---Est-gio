import handler from "vinext/server/fetch-handler";

import { applySecurityHeaders } from "../lib/security-response";

const worker = {
  async fetch(
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const response = await handler.fetch(request, env, ctx);
    return applySecurityHeaders(response, new URL(request.url).pathname);
  },
};

export default worker;
