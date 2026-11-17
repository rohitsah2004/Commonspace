// Existing dense source retains legacy dynamic payloads; new modules stay strict.
export const legacyPayloadFiles = [
  "app/api/analytics/route.ts",
  "app/api/export/route.ts",
  "app/api/manage/route.ts",
  "app/api/newsletter/route.ts",
  "app/api/posts/*/route.ts",
  "app/api/revisions/*/route.ts",
  "app/api/subscribe/route.ts",
  "app/api/subscription/route.ts",
  "app/collections/*/page.tsx",
  "app/collections/page.tsx",
  "app/extras.tsx",
  "app/feed.xml/route.ts",
  "app/files/*/route.ts",
  "app/post/*/page.tsx",
  "app/preview/*/page.tsx",
  "app/sitemap.ts",
  "app/studio/manage/tools.tsx",
  "app/studio/studio.tsx",
  "lib/content.tsx",
  "lib/mail.ts",
  "lib/server.ts"
];
