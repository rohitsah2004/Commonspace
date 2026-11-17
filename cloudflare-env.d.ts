declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
declare namespace Cloudflare { interface Env { OWNER_EMAIL?: string; } }

declare namespace Cloudflare { interface Env { SITE_URL?: string; } }

declare namespace Cloudflare { interface Env { RATE_LIMIT_SALT?: string; } }
