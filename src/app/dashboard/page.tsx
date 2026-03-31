import { createClient } from "@/lib/supabase/server";
import { DraftCard } from "@/components/draft-card";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get today's drafts
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayDrafts } = await supabase
    .from("drafts")
    .select("*, prospects(target, contact_name, contact_email), campaigns(name, brand_company)")
    .eq("user_id", user.id)
    .gte("created_at", `${today}T00:00:00Z`)
    .order("created_at", { ascending: false });

  // Get recent drafts (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data: recentDrafts } = await supabase
    .from("drafts")
    .select("*, prospects(target, contact_name, contact_email), campaigns(name, brand_company)")
    .eq("user_id", user.id)
    .lt("created_at", `${today}T00:00:00Z`)
    .gte("created_at", `${weekAgo}T00:00:00Z`)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(20);

  // Get daily usage
  const { count: todayCount } = await supabase
    .from("drafts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", `${today}T00:00:00Z`)
    .neq("status", "error");

  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_limit")
    .eq("id", user.id)
    .single();

  const used = todayCount ?? 0;
  const limit = profile?.daily_limit ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Drafts</h1>
          <p className="text-gray-400 text-sm mt-1">
            Review, copy, and send. Each draft includes a personalized email and PDF report.
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">
            {used}
            <span className="text-gray-600 text-lg">/{limit}</span>
          </div>
          <p className="text-gray-500 text-xs">drafts today</p>
        </div>
      </div>

      {/* Today's drafts */}
      {(todayDrafts?.length ?? 0) > 0 ? (
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">Today</h2>
          <div className="grid gap-4">
            {todayDrafts!.map((draft) => (
              <DraftCard key={draft.id} draft={draft} />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center mb-12">
          <div className="w-16 h-16 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No drafts yet today</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Your pipeline runs every morning at 8 AM. Once you&apos;ve set up a campaign and
            uploaded prospects, your personalized drafts will appear here — ready to copy and send.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link
              href="/dashboard/campaigns/new"
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors"
            >
              Create a campaign
            </Link>
            <Link
              href="/dashboard/prospects"
              className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              Upload prospects
            </Link>
          </div>
        </div>
      )}

      {/* Recent drafts */}
      {(recentDrafts?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent</h2>
          <div className="grid gap-4">
            {recentDrafts!.map((draft) => (
              <DraftCard key={draft.id} draft={draft} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
