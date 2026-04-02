import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, plan, daily_limit")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top nav */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="text-xl font-bold text-white">
                DemoDraft
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  href="/dashboard"
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition-colors"
                >
                  Drafts
                </Link>
                <Link
                  href="/dashboard/campaigns"
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition-colors"
                >
                  Campaigns
                </Link>
                <Link
                  href="/dashboard/prospects"
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition-colors"
                >
                  Prospects
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                {profile?.plan ?? "free"} — {profile?.daily_limit ?? 0}/day
              </span>
              <span className="text-sm text-gray-400">
                {profile?.full_name ?? user.email}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
