// open-next.config.ts
// OpenNext adapter config for deploying this Next.js 16 app to Cloudflare
// Workers. We use a "dummy" incremental cache (the dashboard is mostly dynamic
// data fetched live from D1) so no R2 bucket is required.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  incrementalCache: "dummy",
});
