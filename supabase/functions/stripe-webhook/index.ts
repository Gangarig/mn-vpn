import Stripe from "npm:stripe@17.7.0";
import { adminClient, json, stripe } from "../_shared/billing.ts";

const subscriptionStatuses = new Set(["inactive", "trialing", "active", "past_due", "unpaid", "incomplete", "incomplete_expired", "paused", "cancelled"]);
const idOf = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;
const iso = (seconds: number | null | undefined) => seconds ? new Date(seconds * 1000).toISOString() : null;

function planFor(subscription: Stripe.Subscription) {
  const configured = new Map([[Deno.env.get("STRIPE_PRICE_MONTHLY"), "monthly"], [Deno.env.get("STRIPE_PRICE_YEARLY"), "yearly"]]);
  const price = subscription.items.data[0]?.price.id;
  const plan = subscription.metadata.plan || configured.get(price);
  return plan === "monthly" || plan === "yearly" ? plan : null;
}

async function userForCustomer(customerId: string | undefined) {
  if (!customerId) return null;
  const { data } = await adminClient().from("billing_customers").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.user_id ?? null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = idOf(subscription.customer);
  const userId = await userForCustomer(customerId);
  const plan = planFor(subscription);
  if (!userId || !plan) throw new Error("Subscription has no known Nutag customer or price");
  const db = adminClient();
  const status = subscription.status === "canceled" ? "cancelled" : subscription.status;
  if (!subscriptionStatuses.has(status)) throw new Error(`Unsupported Stripe subscription status: ${status}`);
  const expiresAt = iso(subscription.current_period_end);
  const { data: row, error } = await db.from("subscriptions").upsert({
    user_id: userId, plan, status, stripe_customer_id: customerId, stripe_subscription_id: subscription.id,
    current_period_end: expiresAt, cancel_at_period_end: subscription.cancel_at_period_end,
    latest_invoice_id: idOf(subscription.latest_invoice), ended_at: subscription.ended_at ? iso(subscription.ended_at) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id" }).select("id").single();
  if (error) throw error;
  const active = (status === "active" || status === "trialing") && (!expiresAt || new Date(expiresAt) > new Date());
  const { error: entitlementError } = await db.from("vpn_entitlements").upsert({
    user_id: userId, subscription_id: row.id, plan, active, expires_at: expiresAt, updated_at: new Date().toISOString(),
  });
  if (entitlementError) throw entitlementError;
}

async function syncInvoice(invoice: Stripe.Invoice) {
  const customerId = idOf(invoice.customer); const userId = await userForCustomer(customerId);
  if (!userId) return; // Ignore unrelated Stripe invoices safely.
  const db = adminClient();
  const { error } = await db.from("invoices").upsert({
    stripe_invoice_id: invoice.id, user_id: userId, stripe_subscription_id: idOf(invoice.subscription), status: invoice.status ?? "unknown",
    amount_paid: invoice.amount_paid, currency: invoice.currency, hosted_invoice_url: invoice.hosted_invoice_url,
    invoice_pdf: invoice.invoice_pdf, period_end: iso(invoice.period_end), updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const signature = req.headers.get("stripe-signature"); const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !secret) return json({ error: "Webhook signature unavailable" }, 400);
  let event: Stripe.Event;
  try { event = await stripe().webhooks.constructEventAsync(await req.text(), signature, secret); }
  catch { return json({ error: "Invalid webhook signature" }, 400); }
  const db = adminClient();
  const { data: known } = await db.from("stripe_events").select("status").eq("stripe_event_id", event.id).maybeSingle();
  if (known?.status === "processed") return json({ received: true });
  await db.from("stripe_events").upsert({ stripe_event_id: event.id, event_type: event.type, status: "processing", error_message: null }, { onConflict: "stripe_event_id" });
  try {
    if (event.type.startsWith("customer.subscription.")) await syncSubscription(event.data.object as Stripe.Subscription);
    if (event.type.startsWith("invoice.")) await syncInvoice(event.data.object as Stripe.Invoice);
    await db.from("stripe_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("stripe_event_id", event.id);
    return json({ received: true });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    await db.from("stripe_events").update({ status: "failed", error_message: message.slice(0, 500) }).eq("stripe_event_id", event.id);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
