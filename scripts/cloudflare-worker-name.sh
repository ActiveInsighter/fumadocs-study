#!/usr/bin/env bash
# Prints the Cloudflare Worker that a CI run deploys to: production for main,
# an isolated per-branch preview Worker otherwise.
set -euo pipefail

if [[ "${GITHUB_REF}" == 'refs/heads/main' ]]; then
  echo 'fumadocs-static-docs'
  exit 0
fi

suffix="$(printf '%s' "${GITHUB_REF_NAME}" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-|-$//g' \
  | cut -c1-30)"
suffix="${suffix%-}"
[[ -n "${suffix}" ]] || suffix='branch'
echo "fumadocs-preview-${suffix}"
