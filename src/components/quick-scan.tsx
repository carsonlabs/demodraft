"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function QuickScan() {
  const supabase = createClient();
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    const { data } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setCampaigns(data);
      setSelectedCampaign(data[0]!.id);
    }
  }

  async function handleScan() {
    if (!url.trim() || !selectedCampaign || scanning) return;

    setScanning(true);
    setStatus("Scraping website...");

    try {
      const domain = url.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

      const res = await fetch("/api/pipeline/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: selectedCampaign,
          target: domain,
        }),
      });

      const data = await res.json();

      if (data.status === "success") {
        setStatus(null);
        setUrl("");
        // Refresh the page to show the new draft
        window.location.reload();
      } else {
        setStatus(`Error: ${data.error ?? "Scan failed"}`);
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setScanning(false);
    }
  }

  if (campaigns.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
        <h3 className="text-white font-semibold mb-2">Scan a prospect</h3>
        <p className="text-gray-500 text-sm mb-4">
          Create a campaign first so we know what product to pitch.
        </p>
        <a
          href="/dashboard/campaigns/new"
          className="inline-flex px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors"
        >
          Create Campaign
        </a>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">Scan a prospect</h3>
          <p className="text-gray-500 text-sm">
            Paste a URL — we&apos;ll scrape their site, build a custom demo, and draft your email.
          </p>
        </div>
        {campaigns.length > 1 && (
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleScan()}
          placeholder="example.com"
          disabled={scanning}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50"
        />
        <button
          onClick={handleScan}
          disabled={scanning || !url.trim()}
          className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {scanning ? "Scanning..." : "Scan & Draft"}
        </button>
      </div>

      {status && (
        <div className={`mt-3 text-sm ${status.startsWith("Error") ? "text-red-400" : "text-indigo-400"}`}>
          {scanning && (
            <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-2 align-middle" />
          )}
          {status}
        </div>
      )}
    </div>
  );
}
