import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800/50 px-6 py-4 sticky top-0 bg-gray-950/80 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold">DemoDraft</span>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="text-sm text-gray-400 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-24 pb-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
            <span className="text-indigo-300 text-sm">The anti-spam AI SDR</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6">
            A cold email that{" "}
            <span className="text-indigo-400">is</span> the demo
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Stop sending AI-generated text that buyers ignore.
            DemoDraft scrapes your prospect&apos;s website, builds a custom
            analysis showing exactly how your product helps them, and packages
            it into a branded PDF — ready to send.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="px-8 py-3.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-500 transition-colors text-lg"
            >
              Start for free
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-3.5 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition-colors text-lg"
            >
              See pricing
            </Link>
          </div>

          <p className="text-gray-600 text-sm mt-6">
            10 personalized demos per day. Copy-paste to send. Your domain stays safe.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
        <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
          Set it up once. Wake up to personalized demos every morning.
        </p>

        <div className="grid md:grid-cols-4 gap-8">
          {[
            {
              step: "1",
              title: "Create a campaign",
              desc: "Tell us what you sell, your value prop, and your branding. Takes 2 minutes.",
            },
            {
              step: "2",
              title: "Add prospects",
              desc: "Paste a list of URLs or upload a CSV. These are the companies you want to reach.",
            },
            {
              step: "3",
              title: "AI builds demos",
              desc: "We scrape each site, analyze it against your product, and generate a branded PDF report.",
            },
            {
              step: "4",
              title: "Copy, paste, send",
              desc: "Review the email + PDF in your dashboard. Copy it. Paste into your email client. Done.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-indigo-400 font-bold">{item.step}</span>
              </div>
              <h3 className="text-white font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why different */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why this is different
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="text-2xl mb-3">
                <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Visual, not verbal</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                AI SDR tools send better-worded spam. We send proof you actually
                looked at their site — with a real analysis attached as a branded PDF.
              </p>
            </div>

            <div>
              <div className="text-2xl mb-3">
                <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Domain-safe by design</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                We cap at 10/day and you send manually. No API access to revoke,
                no spam filters to trigger, no domain reputation to tank.
              </p>
            </div>

            <div>
              <div className="text-2xl mb-3">
                <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Works for any product</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                SaaS, agency, consulting, e-commerce — if you can describe what
                you sell, DemoDraft builds a custom demo for every prospect.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Built for founders who sell</h2>
        <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
          Any B2B product. Any vertical. One pipeline.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              title: "SaaS Founders",
              desc: "Show prospects exactly which features solve their specific workflow problems, with scores and recommendations.",
            },
            {
              title: "Agencies",
              desc: "Send a mini-audit of their website — SEO gaps, design issues, performance scores — as your calling card.",
            },
            {
              title: "Consultants",
              desc: "Demonstrate expertise by analyzing their business before the first call. Show up with insights, not a pitch.",
            },
            {
              title: "Service Providers",
              desc: "Accounting firm? Show them their financial exposure. Security firm? Show them their vulnerabilities.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-colors"
            >
              <h3 className="text-white font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Stop sending cold emails.
            <br />
            Start sending cold demos.
          </h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            Set up your first campaign in 2 minutes. Your first personalized
            demo is free.
          </p>
          <Link
            href="/login"
            className="inline-flex px-8 py-3.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-500 transition-colors text-lg"
          >
            Get started free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-gray-600 text-sm">DemoDraft</span>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="text-gray-600 text-sm hover:text-gray-400">
              Pricing
            </Link>
            <Link href="/login" className="text-gray-600 text-sm hover:text-gray-400">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
