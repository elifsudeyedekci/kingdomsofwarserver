import { Shell } from '@/components/Shell';
import { buildMetadata } from '@/lib/pages';

export const generateMetadata = () => buildMetadata('tr', []);
export default function Page() { return <Shell lang="tr" slug={[]} />; }
