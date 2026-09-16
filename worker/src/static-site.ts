export interface StaticSiteEnv {
  ASSETS: Fetcher;
}

/**
 * Serves the files in ../site through Cloudflare's static-assets binding.
 * Keeping this Worker separate means frontend deployments never alter the API.
 */
export default {
  fetch(request: Request, env: StaticSiteEnv): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<StaticSiteEnv>;
