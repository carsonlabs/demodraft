"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewCampaignPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brandName: "",
    brandCompany: "",
    brandSite: "",
    brandEmail: "",
    brandCalendarLink: "",
    brandTagline: "",
    brandColorPrimary: "#6366f1",
    brandColorDark: "#1e1b4b",
    valueProp: "",
    productDescription: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("campaigns").insert({
      user_id: user.id,
      name: form.name,
      brand_name: form.brandName,
      brand_company: form.brandCompany,
      brand_site: form.brandSite,
      brand_email: form.brandEmail,
      brand_calendar_link: form.brandCalendarLink,
      brand_tagline: form.brandTagline,
      brand_color_primary: form.brandColorPrimary,
      brand_color_dark: form.brandColorDark,
      value_prop: form.valueProp,
      product_description: form.productDescription,
    });

    if (!error) {
      router.push("/dashboard/campaigns");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">New Campaign</h1>
      <p className="text-gray-400 text-sm mb-8">
        Step {step} of 3 — Tell us about your product so we can build custom demos for your prospects.
      </p>

      {/* Step 1: Product */}
      {step === 1 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">What are you selling?</h2>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Campaign Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g., LinkRescue Outreach"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Value Proposition</label>
            <input
              type="text"
              value={form.valueProp}
              onChange={(e) => update("valueProp", e.target.value)}
              placeholder="e.g., We find and fix broken affiliate links that cost you revenue"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Product Description</label>
            <textarea
              value={form.productDescription}
              onChange={(e) => update("productDescription", e.target.value)}
              placeholder="Describe what your product does, who it's for, and how it helps. The more specific, the better the demos."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!form.name || !form.valueProp || !form.productDescription}
            className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next: Branding
          </button>
        </div>
      )}

      {/* Step 2: Branding */}
      {step === 2 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Brand your demos</h2>
          <p className="text-gray-400 text-sm">This is how your PDF reports will look.</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Your Name</label>
              <input
                type="text"
                value={form.brandName}
                onChange={(e) => update("brandName", e.target.value)}
                placeholder="Carson Roell"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Company Name</label>
              <input
                type="text"
                value={form.brandCompany}
                onChange={(e) => update("brandCompany", e.target.value)}
                placeholder="LinkRescue"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Website</label>
              <input
                type="text"
                value={form.brandSite}
                onChange={(e) => update("brandSite", e.target.value)}
                placeholder="linkrescue.io"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={form.brandEmail}
                onChange={(e) => update("brandEmail", e.target.value)}
                placeholder="carson@linkrescue.io"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Calendar Link (optional)</label>
            <input
              type="text"
              value={form.brandCalendarLink}
              onChange={(e) => update("brandCalendarLink", e.target.value)}
              placeholder="https://cal.com/you/15min"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Tagline</label>
            <input
              type="text"
              value={form.brandTagline}
              onChange={(e) => update("brandTagline", e.target.value)}
              placeholder="Find and fix broken links before they cost you revenue"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Primary Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.brandColorPrimary}
                  onChange={(e) => update("brandColorPrimary", e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer bg-gray-800 border border-gray-700"
                />
                <input
                  type="text"
                  value={form.brandColorPrimary}
                  onChange={(e) => update("brandColorPrimary", e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Dark Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.brandColorDark}
                  onChange={(e) => update("brandColorDark", e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer bg-gray-800 border border-gray-700"
                />
                <input
                  type="text"
                  value={form.brandColorDark}
                  onChange={(e) => update("brandColorDark", e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 bg-gray-800 text-gray-400 font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!form.brandName || !form.brandCompany || !form.brandEmail}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Review & Create</h2>

          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">Campaign</span>
              <span className="text-white text-sm">{form.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">Company</span>
              <span className="text-white text-sm">{form.brandCompany}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">Value Prop</span>
              <span className="text-white text-sm text-right max-w-xs">{form.valueProp}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Colors</span>
              <div className="flex gap-2">
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: form.brandColorPrimary }}
                />
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: form.brandColorDark }}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2.5 bg-gray-800 text-gray-400 font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-40"
            >
              {saving ? "Creating..." : "Create Campaign"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
