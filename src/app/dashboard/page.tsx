import { createClient } from "@/lib/supabase/server";
import { DraftCard } from "@/components/draft-card";
import { QuickScan } from "@/components/quick-scan";

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

      {/* Quick scan */}
      <QuickScan />

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
      ) : null}

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
