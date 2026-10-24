---
name: cloudflare-workers-assets
description: Build, validate, and deploy this Fumadocs Next.js static export to Cloudflare Workers Static Assets using the existing sharded GitHub Actions workflow.
---

# Cloudflare Workers Static Assets

Repository-local skill adapted from Anyworkflow-remote's deployment skill and
this project's actual configuration. This is not a Cloudflare-published skill.

Use for `wrangler.jsonc`, static export, RSC routing, asset upload, deployment
Actions, workers.dev, or custom-domain changes. Read `AGENTS.md`, `package.json`,
`wrangler.jsonc`, and the affected workflow/scripts before editing.

## Deployment contract

- This is a Next.js/Fumadocs static export. The deployed asset directory is
  `.static-docs/`, not `dist/` or an assumed Next.js default output directory.
- Preserve `assets.not_found_handling = "404-page"`, the generated `404.html`,
  and `assets.html_handling = "auto-trailing-slash"`.
- Preserve the export/shard pipeline and RSC rewrites. The asset preparation
  script translates `.static-docs/edgeone.json` into `_redirects`, `_headers`,
  and `.assetsignore`; edit the generator rather than generated output.
- Preserve Markdown UTF-8 headers, Unicode paths, root/docs entry points,
  search assets, and hashed JS/CSS references. Do not introduce an SPA fallback.
- `npm run build:cloudflare-assets` performs the static build and asset
  preparation. Prefer the existing GitHub Actions workflow for full builds;
  run a full local build only when explicitly requested.
- Use `.github/workflows/deploy-cloudflare-worker-assets.yml` with explicit
  `deploy=false` and `shards=8` for build-only validation. Its current default
  for `deploy` is true, so never omit the input on a validation dispatch.
- Follow existing session authorization for pushes and workflow dispatches.
  Production deployment or merging to main requires explicit authorization.
- CI uses `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Keep credentials
  out of source, generated files, logs, and browser bundles.

## Verification

Run targeted tests for the changed scripts or routing, plus type checks when
application types change. Inspect the actual Actions result for CI changes.
Asset pre-upload is an optimization, not deployment success: report a deployed
Worker only after the deploy workflow succeeds and Wrangler confirms it.

For an authorized deployment, verify `/docs`, one nested page, client-side
navigation/RSC requests, search, a Unicode route, a Markdown view, and a missing
page's 404 behavior on the deployed URL.

## Official references

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/
- https://developers.cloudflare.com/workers/static-assets/redirects/
- https://developers.cloudflare.com/workers/static-assets/headers/
- https://developers.cloudflare.com/workers/wrangler/configuration/

Fetch relevant current documentation when behavior or platform limits matter.
