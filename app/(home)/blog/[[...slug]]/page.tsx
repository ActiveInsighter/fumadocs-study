import { BlogHero } from '@/components/blog-hero';
import { getMDXComponents } from '@/components/mdx';
import { siteConfig } from '@/lib/site-config';
import { toCanonicalPagePath } from '@/lib/site-url';
import { blogSource } from '@/lib/source';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { DocsBody } from 'fumadocs-ui/layouts/docs/page';

type PageParameters = {
  params: Promise<{
    slug?: string[];
  }>;
};

export const dynamicParams = false;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function BlogIndex() {
  const posts = blogSource
    .getPages()
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return (
    <main className="container mx-auto max-w-3xl px-6 py-16 font-serif">
      <h1 className="text-4xl font-semibold tracking-tight">Blog</h1>
      <p className="mt-3 text-fd-muted-foreground">
        构建笔记、部署流程与工程随笔。
      </p>
      <ul className="mt-12 space-y-10">
        {posts.map((post) => (
          <li key={post.url}>
            <Link href={post.url} className="group block">
              <h2 className="text-xl font-medium underline-offset-4 group-hover:underline">
                {post.data.title}
              </h2>
              <p className="mt-1 text-sm text-fd-muted-foreground">
                <time>{formatDate(post.data.date)}</time>
                {post.data.author ? ` · ${post.data.author}` : null}
              </p>
              {post.data.description ? (
                <p className="mt-2 text-fd-muted-foreground">
                  {post.data.description}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

async function BlogPost({ slug }: { slug: string[] }) {
  const page = blogSource.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const hero = page.data.hero;

  return (
    <>
      {hero ? (
        <BlogHero
          author={page.data.author}
          config={hero}
          date={page.data.date}
          description={page.data.description}
          title={page.data.title}
          toc={page.data.toc}
        />
      ) : null}
    <main className={`container mx-auto max-w-3xl px-6 font-serif ${hero ? 'pb-16 pt-12' : 'py-16'}`}>
      <article>
        {hero ? (
          <p className="text-sm text-fd-muted-foreground">
            <time dateTime={page.data.date.toISOString()}>{formatDate(page.data.date)}</time>
            {page.data.author ? ` · ${page.data.author}` : null}
          </p>
        ) : (
          <>
            <h1 className="text-4xl font-semibold tracking-tight">
              {page.data.title}
            </h1>
            <p className="mt-3 text-sm text-fd-muted-foreground">
              <time>{formatDate(page.data.date)}</time>
              {page.data.author ? ` · ${page.data.author}` : null}
            </p>
            {page.data.description ? (
              <p className="mt-4 text-lg text-fd-muted-foreground">
                {page.data.description}
              </p>
            ) : null}
          </>
        )}
        <DocsBody id="blog-body" className={hero ? 'mt-6' : 'mt-8'}>
          <MDX
            components={getMDXComponents({
              a: createRelativeLink(blogSource, page),
            })}
          />
        </DocsBody>
      </article>
      <div className="mt-12 border-t pt-6 text-sm">
        <Link href="/blog" className="text-fd-muted-foreground hover:underline">
          ← 返回博客列表
        </Link>
      </div>
    </main>
    </>
  );
}

export default async function Page({ params }: PageParameters) {
  const { slug } = await params;
  return slug && slug.length > 0 ? <BlogPost slug={slug} /> : <BlogIndex />;
}

export function generateStaticParams() {
  return [{ slug: [] }, ...blogSource.generateParams()];
}

export async function generateMetadata({
  params,
}: PageParameters): Promise<Metadata> {
  const { slug } = await params;
  if (!slug || slug.length === 0) {
    return { title: 'Blog', alternates: { canonical: '/blog/' } };
  }

  const page = blogSource.getPage(slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: toCanonicalPagePath(page.url) },
    openGraph: {
      // Child openGraph replaces the root object, so restate the site fields.
      type: 'article',
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      title: page.data.title,
      description: page.data.description,
      publishedTime: page.data.date.toISOString(),
      authors: page.data.author ? [page.data.author] : undefined,
    },
  };
}
