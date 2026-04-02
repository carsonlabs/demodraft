"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    description: "See how it works",
    features: ["1 campaign", "3 demos per day", "See real results before upgrading"],
    cta: "Get Started",
    highlighted: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "$49",
    period: "/mo",
    description: "For solo founders doing outreach",
    features: [
      "10 personalized demos/day",
      "2 campaigns",
      "Branded PDF reports",
      "AI-powered website analysis",
      "Copy-paste email drafts",
      "Daily auto-pipeline",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$99",
    period: "/mo",
    description: "For agencies and power users",
    features: [
      "25 personalized demos/day",
      "Unlimited campaigns",
      "All PDF templates",
      "AI-powered website analysis",
      "Copy-paste email drafts",
      "Daily auto-pipeline",
      "Priority support",
    ],
    cta: "Start Free Trial",
    highlighted: false,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (planId: string) => {
    if (planId === "free") {
      window.location.href = "/login";
      return;
    }

    setLoading(planId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
    setLoading(null);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-800/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white">
            DemoDraft
          </Link>
          <Link
            href="/login"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Pay for what you use. No contracts, no hidden fees.
            <br />
            Cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-8 ${
                plan.highlighted
                  ? "bg-indigo-600/10 border-2 border-indigo-500 relative"
                  : "bg-gray-900 border border-gray-800"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}

              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <p className="text-gray-500 text-sm mt-1">{plan.description}</p>

              <div className="mt-6 mb-8">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-gray-500">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <svg
                      className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        plan.highlighted ? "text-indigo-400" : "text-gray-600"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={loading === plan.id}
                className={`w-full py-3 rounded-lg font-medium text-sm transition-colors ${
                  plan.highlighted
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "bg-gray-800 text-white hover:bg-gray-700"
                } disabled:opacity-50`}
              >
                {loading === plan.id ? "Loading..." : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-600 text-sm mt-12">
          All plans include a 7-day free trial. No credit card required to start.
        </p>
      </div>
    </div>
  );
}
