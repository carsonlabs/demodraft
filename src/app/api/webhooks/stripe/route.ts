import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, getPlanByPriceId } from "@/lib/stripe/config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      if (!userId) break;

      // Get subscription to find the plan
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = subscription.items.data[0]?.price.id ?? "";
      const plan = getPlanByPriceId(priceId) ?? "starter";

      await supabase
        .from("profiles")
        .update({
          plan,
          daily_limit: PLANS[plan].dailyLimit,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price.id ?? "";
      const plan = getPlanByPriceId(priceId);

      if (!plan) break;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .limit(1);

      if (profiles && profiles.length > 0) {
        await supabase
          .from("profiles")
          .update({
            plan,
            daily_limit: PLANS[plan].dailyLimit,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profiles[0]!.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .limit(1);

      if (profiles && profiles.length > 0) {
        await supabase
          .from("profiles")
          .update({
            plan: "free",
            daily_limit: 0,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profiles[0]!.id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
