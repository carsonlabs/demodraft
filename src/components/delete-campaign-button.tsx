"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteCampaignButton({ campaignId }: { campaignId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleDelete() {
    setDeleting(true);
    // Cascade deletes prospects and drafts via FK
    await supabase.from("campaigns").delete().eq("id", campaignId);
    router.refresh();
    setConfirming(false);
    setDeleting(false);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1 text-xs font-medium text-red-400 bg-red-900/30 rounded-md hover:bg-red-900/50 transition-colors"
        >
          {deleting ? "..." : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-gray-600 hover:text-red-400 transition-colors"
      title="Delete campaign"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}
