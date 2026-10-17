"use client";

import { useState } from 'react';
import Link from 'next/link';

const SUBJECTS = [
  { value: '', label: 'Select a subject...' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'support', label: 'Player Support' },
  { value: 'press', label: 'Press & Media' },
  { value: 'partnerships', label: 'Partnerships' },
  { value: 'dmca', label: 'DMCA / Copyright' },
] as const;

const SOCIAL_LINKS = [
  { label: 'Twitter / X', href: 'https://twitter.com/KoWMobileGame', handle: '@KoWMobileGame' },
  { label: 'Discord', href: '#', handle: 'discord.gg/kingdoms-of-war' },
  { label: 'Reddit', href: '#', handle: 'r/KingdomsOfWar' },
  { label: 'YouTube', href: '#', handle: 'Kingdoms of War Official' },
] as const;

function TwitterIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
      className="w-5 h-5" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
      className="w-5 h-5" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function RedditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
      className="w-5 h-5" aria-hidden="true">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
      className="w-5 h-5" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

const SOCIAL_ICONS = [TwitterIcon, DiscordIcon, RedditIcon, YouTubeIcon];

const inputClass =
  'w-full bg-stone-900 border border-stone-700 text-white placeholder-stone-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition';

export function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
      {/* Contact Form */}
      <div className="lg:col-span-3">
        {submitted ? (
          <div className="bg-stone-900 border border-amber-500/30 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-4 text-amber-500 font-bold" aria-hidden="true">&#10003;</div>
            <h2 className="text-2xl font-bold text-white mb-2">Message Received</h2>
            <p className="text-stone-400">
              Thanks for reaching out! We&apos;ll get back to you at{' '}
              <span className="text-amber-500">{form.email}</span> within 48 hours.
            </p>
            <button
              onClick={() => {
                setForm({ name: '', email: '', subject: '', message: '' });
                setSubmitted(false);
              }}
              className="mt-6 text-sm text-stone-400 hover:text-amber-500 underline underline-offset-2 transition-colors"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            aria-label="Contact form"
            noValidate
          >
            <div>
              <label
                htmlFor="contact-name"
                className="block text-sm font-medium text-stone-300 mb-1.5"
              >
                Name <span className="text-amber-500" aria-hidden="true">*</span>
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                required
                autoComplete="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="contact-email"
                className="block text-sm font-medium text-stone-300 mb-1.5"
              >
                Email <span className="text-amber-500" aria-hidden="true">*</span>
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="contact-subject"
                className="block text-sm font-medium text-stone-300 mb-1.5"
              >
                Subject <span className="text-amber-500" aria-hidden="true">*</span>
              </label>
              <select
                id="contact-subject"
                name="subject"
                required
                value={form.subject}
                onChange={handleChange}
                className={`${inputClass} cursor-pointer`}
              >
                {SUBJECTS.map((s) => (
                  <option key={s.value} value={s.value} disabled={s.value === ''}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="contact-message"
                className="block text-sm font-medium text-stone-300 mb-1.5"
              >
                Message <span className="text-amber-500" aria-hidden="true">*</span>
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={6}
                value={form.message}
                onChange={handleChange}
                placeholder="Tell us what's on your mind..."
                className={`${inputClass} resize-none`}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm py-3.5 rounded-xl transition-colors"
            >
              Send Message
            </button>

            <p className="text-xs text-stone-500 text-center">
              By submitting this form you agree to our{' '}
              <Link
                href="/privacy"
                className="text-amber-500/80 hover:text-amber-400 underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </form>
        )}
      </div>

      {/* Sidebar Info */}
      <aside className="lg:col-span-2 space-y-6">
        {/* Direct Contact */}
        <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-4">Direct Contact</h2>
          <div className="space-y-3 text-sm text-stone-400">
            <div>
              <p className="text-stone-500 text-xs uppercase tracking-widest mb-0.5">Support</p>
              <a
                href="mailto:support@kingdoms-of-war.com"
                className="text-amber-500 hover:text-amber-400 transition-colors"
              >
                support@kingdoms-of-war.com
              </a>
            </div>
            <div>
              <p className="text-stone-500 text-xs uppercase tracking-widest mb-0.5">
                Press &amp; Media
              </p>
              <a
                href="mailto:press@kingdoms-of-war.com"
                className="text-amber-500 hover:text-amber-400 transition-colors"
              >
                press@kingdoms-of-war.com
              </a>
            </div>
            <div>
              <p className="text-stone-500 text-xs uppercase tracking-widest mb-0.5">Legal</p>
              <a
                href="mailto:legal@kingdoms-of-war.com"
                className="text-amber-500 hover:text-amber-400 transition-colors"
              >
                legal@kingdoms-of-war.com
              </a>
            </div>
          </div>
        </div>

        {/* Response Time */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
          <p className="text-amber-500 font-semibold text-sm mb-1">Response Time</p>
          <p className="text-stone-300 text-sm leading-relaxed">
            We respond within <strong className="text-white">48 hours</strong> on business days.
            For urgent account issues, please include your player ID in the message.
          </p>
        </div>

        {/* Company Address */}
        <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-3">Office</h2>
          <address className="not-italic text-sm text-stone-400 space-y-0.5">
            <p className="font-medium text-stone-300">Kingdoms of War Inc.</p>
            <p>123 Strategy Lane</p>
            <p>Wilmington, DE 19801</p>
            <p>United States</p>
          </address>
        </div>

        {/* Social Links */}
        <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-4">Find Us Online</h2>
          <ul className="space-y-3">
            {SOCIAL_LINKS.map((link, i) => {
              const Icon = SOCIAL_ICONS[i];
              return (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-stone-400 hover:text-white transition-colors group"
                    aria-label={`${link.label}: ${link.handle}`}
                  >
                    <span className="text-stone-500 group-hover:text-amber-500 transition-colors">
                      <Icon />
                    </span>
                    <span className="text-sm">
                      <span className="block text-xs text-stone-500">{link.label}</span>
                      <span className="font-medium">{link.handle}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
