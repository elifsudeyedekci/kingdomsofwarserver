import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { allSlugs, buildMetadata, isValid } from '@/lib/pages';

export const dynamicParams = false;
export const generateStaticParams = () => allSlugs().filter((s) => s.length > 0).map((slug) => ({ slug }));
type P = { params: Promise<{ slug: string[] }> };
export async function generateMetadata({ params }: P) { const { slug } = await params; return buildMetadata('tr', slug); }
export default async function Page({ params }: P) { const { slug } = await params; if (!isValid(slug)) notFound(); return <Shell lang="tr" slug={slug} />; }
