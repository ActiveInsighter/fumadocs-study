const DEFAULT_SITE_ORIGIN = 'https://docs.any1.tech';

export function getSiteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_ORIGIN).replace(/\/+$/, '');
}

export function toAbsoluteSiteUrl(path: string, origin = getSiteOrigin()) {
  return new URL(path, `${origin.replace(/\/+$/, '')}/`).toString();
}
