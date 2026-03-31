"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = "url" | "refine" | "creating";

export default function NewCampaignPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    valueProp: "",
    website: "",
    icpDescription: "",
    icpIndustry: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleAnalyze() {
    if (!url.trim()) return;
    setAnalyzing(true);
    setError("");

    try {
      const domain = url.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
      const res = await fetch("/api/onboard/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: domain }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not analyze that URL");
        setAnalyzing(false);
        return;
      }

      setForm({
        name: data.productName ?? "",
        valueProp: data.valueProp ?? "",
        website: data.website ?? domain,
        icpDescription: data.icpDescription ?? "",
        icpIndustry: data.icpIndustry ?? "",
      });
      setStep("refine");
    } catch {
      setError("Something went wrong. Try again.");
    }
    setAnalyzing(false);
  }

  async function handleCreate() {
    if (!form.name || !form.valueProp || !form.icpDescription) return;
    setStep("creating");
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: campaign, error: campError } = await supabase
      .from("campaigns")
      .insert({
        user_id: user.id,
        name: form.name,
        brand_company: form.name,
        brand_site: form.website,
        brand_email: user.email,
        value_prop: form.valueProp,
        product_description: form.valueProp,
        icp_description: form.icpDescription,
        icp_industry: form.icpIndustry,
        icp_keywords: `${form.icpDescription} ${form.icpIndustry}`.trim(),
      })
      .select()
      .single();

    if (campError || !campaign) {
      setError("Failed to create campaign. Please try again.");
      setStep("refine");
      return;
    }

    // Trigger first batch
    try {
      await fetch("/api/pipeline/first-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
    } catch {
      // Campaign still created
    }

    router.push("/dashboard?setup=complete");
  }

  const industries = [
    "E-commerce / DTC",
    "SaaS / Software",
    "Agency / Consulting",
    "Blog / Content / Media",
    "Restaurant / Food Service",
    "Fitness / Wellness",
    "Real Estate",
    "Healthcare / Medical",
    "Finance / Accounting",
    "Other",
  ];

  // Step 1: Paste your URL
  if (step === "url") {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-3">What&apos;s your website?</h1>
          <p className="text-gray-400">
            Paste your URL and we&apos;ll figure out the rest.
          </p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              placeholder="yourcompany.com"
              disabled={analyzing}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-lg placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50"
              autoFocus
            />
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !url.trim()}
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {analyzing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </span>
              ) : (
                "Analyze"
              )}
            </button>
          </div>

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          <p className="text-gray-600 text-xs mt-4 text-center">
            We&apos;ll scrape your site and auto-fill your product info + ideal customer profile.
          </p>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => setStep("refine")}
            className="text-gray-600 text-sm hover:text-gray-400 transition-colors"
          >
            Skip — I&apos;ll fill it in manually
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Creating
  if (step === "creating") {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-white mb-3">Setting up your outreach engine</h2>
        <p className="text-gray-400">
          Finding prospects that match your ICP and generating your first demos...
        </p>
      </div>
    );
  }

  // Step 2: Refine auto-filled data
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Review & refine</h1>
      <p className="text-gray-400 text-sm mb-8">
        We analyzed your site and pre-filled everything. Tweak anything that&apos;s off.
      </p>

      <div className="space-y-6">
        {/* Product */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <h2 className="text-white font-semibold">Your product</h2>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Product name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g., LinkRescue"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              What does it do?
            </label>
            <input
              type="text"
              value={form.valueProp}
              onChange={(e) => update("valueProp", e.target.value)}
              placeholder="e.g., We find and fix broken affiliate links that cost you revenue"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Website
            </label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
              placeholder="yourcompany.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-500 placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* ICP */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <h2 className="text-white font-semibold">Your ideal customer</h2>
          <p className="text-gray-500 text-sm">
            We&apos;ll use this to automatically find matching companies every day.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Who&apos;s your ideal customer?
            </label>
            <textarea
              value={form.icpDescription}
              onChange={(e) => update("icpDescription", e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Industry</label>
            <select
              value={form.icpIndustry}
              onChange={(e) => update("icpIndustry", e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-indigo-500 outline-none"
            >
              <option value="">Select an industry</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={!form.name || !form.valueProp || !form.icpDescription}
          className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-lg"
        >
          Start finding leads
        </button>

        <p className="text-gray-600 text-xs text-center">
          We&apos;ll immediately find matching prospects and generate your first batch of demos.
        </p>
      </div>
    </div>
  );
}
