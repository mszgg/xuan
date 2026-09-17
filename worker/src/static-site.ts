export interface StaticSiteEnv {
  ASSETS: Fetcher;
  TURNSTILE_SITE_KEY?: string;
}

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy': "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://lingji-analysis-api.827793958.workers.dev; media-src 'self'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY'
};

/**
 * Serves the files in ../site through Cloudflare's static-assets binding.
 * Keeping this Worker separate means frontend deployments never alter the API.
 */
export default {
  async fetch(request: Request, env: StaticSiteEnv): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
    const secured = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    if (!headers.get('content-type')?.includes('text/html')) return secured;
    return new HTMLRewriter().on('html', {
      element(element) {
        if (env.TURNSTILE_SITE_KEY) element.setAttribute('data-turnstile-sitekey', env.TURNSTILE_SITE_KEY);
      }
    }).transform(secured);
  },
} satisfies ExportedHandler<StaticSiteEnv>;
