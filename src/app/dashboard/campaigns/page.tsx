import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*, prospects(count), drafts(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 text-sm mt-1">
            Each campaign represents a product you&apos;re selling with its own branding and pitch.
          </p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors"
        >
          New Campaign
        </Link>
      </div>

      {campaigns && campaigns.length > 0 ? (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/dashboard/campaigns/${campaign.id}`}
              className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">{campaign.name}</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    {campaign.brand_company} &middot; {campaign.value_prop?.slice(0, 60)}...
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-white font-semibold">
                      {(campaign.prospects as { count: number }[])?.[0]?.count ?? 0}
                    </p>
                    <p className="text-gray-500 text-xs">prospects</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold">
                      {(campaign.drafts as { count: number }[])?.[0]?.count ?? 0}
                    </p>
                    <p className="text-gray-500 text-xs">drafts</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      campaign.status === "active"
                        ? "bg-green-900/30 text-green-400"
                        : "bg-gray-800 text-gray-500"
                    }`}
                  >
                    {campaign.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <h3 className="text-lg font-medium text-white mb-2">No campaigns yet</h3>
          <p className="text-gray-400 text-sm mb-4">
            Create your first campaign to start generating personalized outreach.
          </p>
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors"
          >
            Create Campaign
          </Link>
        </div>
      )}
    </div>
  );
}
