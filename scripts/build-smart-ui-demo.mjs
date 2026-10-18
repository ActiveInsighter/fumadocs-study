// Local-only single-document static export. Production build behavior is unchanged.
process.env.STATIC_DOCS_ONLY_PATH = '408/knowledge/smart-ui-demo';
await import('./run-static-docs-build.mjs');
