import type { AnchorHTMLAttributes } from 'react';
/** Plain anchor: the site is fully static, every navigation is a normal page load (no client-side RSC prefetching needed). */
export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) { return <a href={href} {...rest} />; }
