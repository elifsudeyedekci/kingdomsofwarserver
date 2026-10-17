'use client';
import { useEffect, useState } from 'react';
import Link from './Link';

export interface Slide { k: string; t: string; p: string; img: string }

export function Hero({ slides, h1, logoAlt, cta, ctaHref, more, moreHref }: { slides: Slide[]; h1: string; logoAlt: string; cta: string; ctaHref: string; more: string; moreHref: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(id);
  }, [paused, slides.length]);
  return (
    <section className="hero" aria-roledescription="carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {slides.map((s, n) => (
        <div key={n} className={`slide${n === i ? ' on' : ''}`} aria-hidden={n === i ? undefined : true} role="group" aria-roledescription="slide">
          <picture>
            <source media="(max-width: 900px)" srcSet={`${s.img}-960.webp`} type="image/webp" />
            <img src={`${s.img}.webp`} alt="" width="1920" height="1080" {...(n === 0 ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })} />
          </picture>
        </div>
      ))}
      <div className="hero-shade" />
      <div className="wrap hero-inner">
        <h1 className="hero-logo"><img src="/brand/game-logo.png" width="520" height="300" alt={h1} fetchPriority="high" /><span className="sr-only"> — {logoAlt}</span></h1>
        <div className="hero-text" aria-live={paused ? 'polite' : 'off'}>
          <p className="kicker">{slides[i].k}</p>
          <p className="hero-title">{slides[i].t}</p>
          <p className="hero-sub">{slides[i].p}</p>
          <div className="hero-actions">
            <Link href={ctaHref} className="btn btn-gold btn-lg">{cta}</Link>
            <Link href={moreHref} className="btn btn-ghost btn-lg">{more}</Link>
          </div>
        </div>
        <div className="dots" role="tablist">
          {slides.map((s, n) => (<button key={n} role="tab" aria-selected={n === i} aria-label={s.t} className={n === i ? 'on' : ''} onClick={() => setI(n)} />))}
        </div>
      </div>
    </section>
  );
}
