"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ProspectsPage() {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [prospects, setProspects] = useState<Record<string, unknown>[]>([]);
  const [csvText, setCsvText] = useState("");
  const [singleUrl, setSingleUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaign) loadProspects();
  }, [selectedCampaign]);

  async function loadCampaigns() {
    const { data } = await supabase
      .from("campaigns")
      .select("id, name")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setCampaigns(data);
      setSelectedCampaign(data[0]!.id);
    }
  }

  async function loadProspects() {
    const { data } = await supabase
      .from("prospects")
      .select("*")
      .eq("campaign_id", selectedCampaign)
      .order("created_at", { ascending: false })
      .limit(100);
    setProspects(data ?? []);
  }

  async function addSingleUrl() {
    if (!singleUrl || !selectedCampaign) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const domain = singleUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    await supabase.from("prospects").upsert(
      {
        campaign_id: selectedCampaign,
        user_id: user.id,
        target: domain,
        status: "queued",
      },
      { onConflict: "campaign_id,target" }
    );

    setSingleUrl("");
    setMessage("Added 1 prospect");
    loadProspects();
    setUploading(false);
  }

  async function uploadCsv() {
    if (!csvText.trim() || !selectedCampaign) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const lines = csvText.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const hasHeader = lines[0]?.toLowerCase().includes("target") || lines[0]?.toLowerCase().includes("url");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    let added = 0;
    for (const line of dataLines) {
      const parts = line.split(",").map((p) => p.trim());
      const target = (parts[0] ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
      if (!target) continue;

      const { error } = await supabase.from("prospects").upsert(
        {
          campaign_id: selectedCampaign,
          user_id: user.id,
          target,
          contact_email: parts[1] || null,
          contact_name: parts[2] || null,
          status: "queued",
        },
        { onConflict: "campaign_id,target" }
      );
      if (!error) added++;
    }

    setCsvText("");
    setMessage(`Added ${added} prospects`);
    loadProspects();
    setUploading(false);
  }

  const statusColor: Record<string, string> = {
    queued: "bg-gray-700 text-gray-300",
    processing: "bg-yellow-900/30 text-yellow-400",
    completed: "bg-green-900/30 text-green-400",
    failed: "bg-red-900/30 text-red-400",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Prospects</h1>
      <p className="text-gray-400 text-sm mb-6">
        Add prospect URLs to your campaign. The pipeline will scan them and generate demos.
      </p>

      {/* Campaign selector */}
      <div className="mb-6">
        <select
          value={selectedCampaign}
          onChange={(e) => setSelectedCampaign(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-indigo-500 outline-none"
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Add prospects */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {/* Single URL */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-white font-medium mb-3">Add a URL</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={singleUrl}
              onChange={(e) => setSingleUrl(e.target.value)}
              placeholder="example.com"
              onKeyDown={(e) => e.key === "Enter" && addSingleUrl()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 outline-none"
            />
            <button
              onClick={addSingleUrl}
              disabled={uploading || !singleUrl}
              className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>

        {/* CSV paste */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-white font-medium mb-3">Paste CSV</h3>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"target,email,name\nexample.com,hello@example.com,Jane"}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm font-mono focus:border-indigo-500 outline-none resize-none mb-2"
          />
          <button
            onClick={uploadCsv}
            disabled={uploading || !csvText.trim()}
            className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-40"
          >
            {uploading ? "Adding..." : "Upload CSV"}
          </button>
        </div>
      </div>

      {message && (
        <p className="text-green-400 text-sm mb-4">{message}</p>
      )}

      {/* Prospect list */}
      {prospects.length > 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Target</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Contact</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Added</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id as string} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3 text-white text-sm">{p.target as string}</td>
                  <td className="px-5 py-3 text-gray-400 text-sm">
                    {(p.contact_email as string) ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[p.status as string] ?? "bg-gray-700 text-gray-300"}`}>
                      {p.status as string}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(p.created_at as string).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">No prospects yet. Add URLs above to get started.</p>
      )}
    </div>
  );
}
