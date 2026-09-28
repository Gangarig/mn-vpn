import { adminClient, json, options, requireUser, stripe } from "../_shared/billing.ts";

const periodEnd = (seconds: number | null | undefined) => seconds ? new Date(seconds * 1000).toISOString() : null;

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(req); if (!user) return json({ error: "Unauthorized" }, 401);
    const db = adminClient();
    const { data: customer } = await db.from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (!customer) return json({ active: false });
    const subscriptions = await stripe().subscriptions.list({ customer: customer.stripe_customer_id, status: "all", limit: 10 });
    const subscription = subscriptions.data.sort((a, b) => b.created - a.created)[0];
    if (!subscription) return json({ active: false });
    const monthly = Deno.env.get("STRIPE_PRICE_MONTHLY"); const yearly = Deno.env.get("STRIPE_PRICE_YEARLY");
    const price = subscription.items.data[0]?.price.id;
    const plan = price === monthly ? "monthly" : price === yearly ? "yearly" : null;
    if (!plan) return json({ error: "Subscription price is not configured" }, 409);
    const status = subscription.status === "canceled" ? "cancelled" : subscription.status;
    const expiresAt = periodEnd(subscription.current_period_end);
    const { data: row, error } = await db.from("subscriptions").upsert({
      user_id: user.id, plan, status, stripe_customer_id: customer.stripe_customer_id, stripe_subscription_id: subscription.id,
      current_period_end: expiresAt, cancel_at_period_end: subscription.cancel_at_period_end, latest_invoice_id: typeof subscription.latest_invoice === "string" ? subscription.latest_invoice : subscription.latest_invoice?.id,
      ended_at: subscription.ended_at ? periodEnd(subscription.ended_at) : null, updated_at: new Date().toISOString(),
    }, { onConflict: "stripe_subscription_id" }).select("id").single();
    if (error) throw error;
    const active = (status === "active" || status === "trialing") && (!expiresAt || new Date(expiresAt) > new Date());
    const { error: entitlementError } = await db.from("vpn_entitlements").upsert({ user_id: user.id, subscription_id: row.id, plan, active, expires_at: expiresAt, updated_at: new Date().toISOString() });
    if (entitlementError) throw entitlementError;
    return json({ active, plan, expiresAt });
  } catch (error) { console.error(error); return json({ error: error instanceof Error ? error.message : "Unable to sync billing" }, 500); }
});
