import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { cn } from '@/lib/utils';

const publicDirectory = resolve(process.cwd(), 'public');
const imagesDirectory = resolve(publicDirectory, 'images');
const localSvgSourcePattern = /^\/images\/(?:[\w.-]+\/)*[\w.-]+\.svg$/u;
const svgRootPattern = /<svg\b[^>]*>/iu;
const svgIdPattern = /\bid=(['"])([^'"]+)\1/gu;
const svgUrlReferencePattern = /url\(\s*#([^\s)]+)\s*\)/gu;
const svgFragmentReferencePattern = /((?:xlink:)?href\s*=\s*)(['"])#([^'"]+)\2/giu;
const svgLabelReferencePattern =
  /\b(aria-labelledby|aria-describedby)(\s*=\s*)(['"])([^'"]*)\3/giu;
const svgStylePattern = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/giu;
const svgScriptPattern =
  /<script\b[^>]*>[\s\S]*?<\/script\s*>|<script\b[^>]*\/>/giu;
const svgEventHandlerPattern =
  /\s+on[a-z][\w:-]*\s*=\s*(['"])[\s\S]*?\1/giu;
const svgExternalHrefPattern =
  /\s+(?:xlink:)?href\s*=\s*(['"])https?:\/\/[^'"]*\1/giu;
const svgCache = new Map<string, string>();

export interface InlineSvgProps {
  /** Local SVG asset path, for example `/images/network/overview.svg`. */
  src: string;
  /** Accessible label equivalent to the alt text of the original image. */
  alt?: string;
  /** Additional classes applied to the wrapper around the inline SVG. */
  className?: string;
}

function resolveLocalSvgPath(src: string): string {
  if (!localSvgSourcePattern.test(src)) {
    throw new Error(
      `InlineSvg only accepts a local SVG asset under /images/: ${src}`,
    );
  }

  const filePath = resolve(publicDirectory, `.${src}`);
  const relativePath = relative(imagesDirectory, filePath);

  if (
    relativePath.length === 0 ||
    relativePath.startsWith('..') ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`InlineSvg resolved outside the local SVG asset directory: ${src}`);
  }

  return filePath;
}

function removeSvgBehavior(content: string): string {
  return content
    .replace(svgScriptPattern, '')
    .replace(svgEventHandlerPattern, '')
    .replace(svgExternalHrefPattern, '');
}

function loadSvg(src: string): string {
  const cached = svgCache.get(src);
  if (cached) return cached;

  const content = scopeSvgIds(
    removeSvgBehavior(
      readFileSync(resolveLocalSvgPath(src), 'utf8')
        .replace(/<\?xml[\s\S]*?\?>/giu, '')
        .replace(/<!DOCTYPE[\s\S]*?>/giu, '')
        .trim(),
    ),
    src,
  );

  if (!svgRootPattern.test(content)) {
    throw new Error(`InlineSvg could not find an SVG root element: ${src}`);
  }

  svgCache.set(src, content);
  return content;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("'", '&#39;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function getSvgIdPrefix(src: string): string {
  const sourceKey = src
    .slice('/images/'.length)
    .replace(/\.svg$/iu, '')
    .replaceAll('/', '--')
    .replace(/[^A-Za-z0-9_-]/gu, '_');

  return `inline-svg-${sourceKey}--`;
}

function scopeSvgIds(content: string, src: string): string {
  const ids = new Map<string, string>();
  const prefix = getSvgIdPrefix(src);
  const scopedContent = content.replace(
    svgIdPattern,
    (_match: string, quote: string, id: string) => {
      const scopedId = `${prefix}${id}`;
      ids.set(id, scopedId);
      return `id=${quote}${scopedId}${quote}`;
    },
  );

  if (ids.size === 0) return scopedContent;

  let result = scopedContent.replace(
    svgUrlReferencePattern,
    (match: string, id: string) => {
      const scopedId = ids.get(id);
      return scopedId ? `url(#${scopedId})` : match;
    },
  );

  result = result.replace(
    svgFragmentReferencePattern,
    (match: string, attribute: string, quote: string, id: string) => {
      const scopedId = ids.get(id);
      return scopedId ? `${attribute}${quote}#${scopedId}${quote}` : match;
    },
  );

  result = result.replace(
    svgLabelReferencePattern,
    (
      _match: string,
      attribute: string,
      equals: string,
      quote: string,
      value: string,
    ) => {
      const scopedValue = value
        .split(/\s+/u)
        .map((id) => ids.get(id) ?? id)
        .join(' ');
      return `${attribute}${equals}${quote}${scopedValue}${quote}`;
    },
  );

  return result.replace(
    svgStylePattern,
    (_match: string, opening: string, styles: string, closing: string) => {
      let scopedStyles = styles;

      for (const [id, scopedId] of ids) {
        // Do not treat a hexadecimal color literal as an ID selector.
        if (/^[0-9a-f]{3,8}$/iu.test(id)) continue;

        const selectorPattern = new RegExp(
          `#${escapeRegExp(id)}(?![A-Za-z0-9_-])`,
          'gu',
        );
        scopedStyles = scopedStyles.replace(selectorPattern, `#${scopedId}`);
      }

      return `${opening}${scopedStyles}${closing}`;
    },
  );
}

function setRootAttribute(rootTag: string, name: string, value: string): string {
  const attributePattern = new RegExp(
    `\\s${name}\\s*=\\s*(["'])[\\s\\S]*?\\1`,
    'iu',
  );
  const attribute = `${name}="${escapeAttribute(value)}"`;

  if (attributePattern.test(rootTag)) {
    return rootTag.replace(attributePattern, ` ${attribute}`);
  }

  return rootTag.replace(/\s*\/?>(?=$)/u, (closing) => ` ${attribute}${closing}`);
}

function addRootClass(rootTag: string): string {
  const classPattern = /\sclass\s*=\s*(["'])([\s\S]*?)\1/iu;
  const classMatch = rootTag.match(classPattern);

  if (classMatch) {
    const classes = classMatch[2].trim();
    if (classes.split(/\s+/u).includes('inline-svg__root')) return rootTag;

    return rootTag.replace(
      classPattern,
      ` class="${escapeAttribute(`${classes} inline-svg__root`)}"`,
    );
  }

  return setRootAttribute(rootTag, 'class', 'inline-svg__root');
}

function prepareSvg(content: string, alt?: string): string {
  const rootMatch = content.match(svgRootPattern);
  if (!rootMatch || rootMatch.index === undefined) {
    throw new Error('InlineSvg could not prepare an SVG without a root element.');
  }

  let rootTag = addRootClass(rootMatch[0]);

  if (alt) {
    rootTag = setRootAttribute(rootTag, 'role', 'img');
    rootTag = setRootAttribute(rootTag, 'aria-label', alt);
  } else {
    rootTag = setRootAttribute(rootTag, 'aria-hidden', 'true');
  }

  return `${content.slice(0, rootMatch.index)}${rootTag}${content.slice(
    rootMatch.index + rootMatch[0].length,
  )}`;
}

export function InlineSvg({ src, alt, className }: InlineSvgProps) {
  return (
    <span
      className={cn('inline-svg', className)}
      dangerouslySetInnerHTML={{ __html: prepareSvg(loadSvg(src), alt) }}
    />
  );
}
