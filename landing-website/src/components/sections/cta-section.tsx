'use client';

export function CtaSection() {
  return (
    <section className="py-24 bg-gradient-to-b from-stone-900 to-stone-950">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Be the First to Play
        </h2>
        <p className="text-stone-400 mb-10">
          Sign up for early access and get exclusive launch rewards — a Legendary Commander and 500 Gold.
        </p>
        <form
          className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
          >
            Get Early Access
          </button>
        </form>
        <p className="text-stone-600 text-xs mt-4">
          No spam. Unsubscribe any time. See our{' '}
          <a href="/privacy" className="text-stone-500 hover:text-white underline">Privacy Policy</a>.
        </p>
      </div>
    </section>
  );
}
