import { adminClient, json, options, requireUser, stripe } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(req); if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: customer } = await adminClient().from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (!customer) return json({ error: "No billing account" }, 404);
    const appUrl = Deno.env.get("APP_URL"); if (!appUrl) throw new Error("APP_URL is not configured");
    const session = await stripe().billingPortal.sessions.create({ customer: customer.stripe_customer_id, return_url: `${appUrl}/dashboard.html` });
    return json({ url: session.url });
  } catch (error) { console.error(error); return json({ error: "Unable to open billing portal" }, 500); }
});
