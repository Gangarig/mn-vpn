import { adminClient, json, options, requireUser, stripe } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { plan } = await req.json();
    const prices: Record<string, string | undefined> = {
      monthly: Deno.env.get("STRIPE_PRICE_MONTHLY"),
      yearly: Deno.env.get("STRIPE_PRICE_YEARLY"),
    };
    if (typeof plan !== "string" || !prices[plan]) return json({ error: "Unknown plan" }, 400);
    const db = adminClient(); const stripeClient = stripe();
    const { data: existing } = await db.from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeClient.customers.create({ email: user.email ?? undefined, metadata: { supabase_user_id: user.id } });
      customerId = customer.id;
      const { error } = await db.from("billing_customers").upsert({ user_id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() });
      if (error) throw error;
    }
    const appUrl = Deno.env.get("APP_URL");
    if (!appUrl) throw new Error("APP_URL is not configured");
    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription", customer: customerId, client_reference_id: user.id,
      line_items: [{ price: prices[plan], quantity: 1 }],
      success_url: `${appUrl}/dashboard.html?checkout=success`, cancel_url: `${appUrl}/pricing.html?checkout=cancelled`,
      metadata: { supabase_user_id: user.id, plan },
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
    });
    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    return json({ url: session.url });
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message : undefined;
    return json({ error: "Unable to start checkout", detail }, 500);
  }
});
