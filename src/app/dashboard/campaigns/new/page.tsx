"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewCampaignPage() {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.valueProp || !form.icpDescription) return;

    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create the campaign
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
      setSaving(false);
      return;
    }

    // Trigger first batch — source prospects + scan immediately
    try {
      const res = await fetch("/api/pipeline/first-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });

      if (!res.ok) {
        console.error("First run failed, but campaign created");
      }
    } catch {
      // Campaign still created, pipeline will catch up on next cron
    }

    router.push("/dashboard?setup=complete");
  };

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

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Set up your outreach</h1>
      <p className="text-gray-400 text-sm mb-8">
        Tell us what you sell and who you sell to. We&apos;ll find prospects and build custom demos automatically.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
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
              What does it do? <span className="text-gray-600">(one line)</span>
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
              Your website <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
              placeholder="e.g., linkrescue.io"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* ICP */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <h2 className="text-white font-semibold">Your ideal customer</h2>
          <p className="text-gray-500 text-sm">
            Describe who you sell to. We&apos;ll use this to find matching companies automatically.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Who&apos;s your ideal customer?
            </label>
            <textarea
              value={form.icpDescription}
              onChange={(e) => update("icpDescription", e.target.value)}
              placeholder="e.g., Food bloggers with affiliate links who get 10k+ monthly visitors. They have lots of outbound links but probably don't check if those links are broken."
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

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || !form.name || !form.valueProp || !form.icpDescription}
          className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-lg"
        >
          {saving ? "Finding your first prospects..." : "Start finding leads"}
        </button>

        <p className="text-gray-600 text-xs text-center">
          We&apos;ll immediately find 10 matching prospects and generate your first batch of demos.
        </p>
      </form>
    </div>
  );
}
