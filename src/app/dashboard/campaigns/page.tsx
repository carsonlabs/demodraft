import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { DeleteCampaignButton } from "@/components/delete-campaign-button";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 text-sm mt-1">
            Each campaign targets a different ICP with your product.
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
            <div
              key={campaign.id}
              className="bg-gray-900 rounded-xl border border-gray-800 p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-medium">{campaign.name}</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    {campaign.value_prop?.slice(0, 80)}
                  </p>
                  {campaign.icp_description && (
                    <p className="text-gray-600 text-xs mt-2">
                      ICP: {campaign.icp_description.slice(0, 100)}
                      {campaign.icp_industry ? ` · ${campaign.icp_industry}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      campaign.status === "active"
                        ? "bg-green-900/30 text-green-400"
                        : "bg-gray-800 text-gray-500"
                    }`}
                  >
                    {campaign.status}
                  </span>
                  <DeleteCampaignButton campaignId={campaign.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <h3 className="text-lg font-medium text-white mb-2">No campaigns yet</h3>
          <p className="text-gray-400 text-sm mb-4">
            Create your first campaign to start generating personalized outreach automatically.
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
