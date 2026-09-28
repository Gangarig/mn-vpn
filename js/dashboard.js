const statusDot = document.getElementById("status-dot");
const statusLabel = document.getElementById("status-label");
const toggleBtn = document.getElementById("toggle-btn");
const sessionList = document.getElementById("session-list");
const planBadge = document.getElementById("plan-badge");
const planCopy = document.getElementById("plan-copy");
const manageBillingBtn = document.getElementById("manage-billing-btn");
const userEmailEl = document.getElementById("user-email");
const logoutLink = document.getElementById("logout-link");
let currentUser;
let activeSessionId;
let hasEntitlement = false;

function renderConnected(isConnected, pending = false) {
  statusDot.classList.toggle("on", isConnected && !pending);
  statusDot.classList.toggle("pending", pending);
  toggleBtn.classList.toggle("connected", isConnected);
  statusLabel.textContent = pending ? "Connecting…" : isConnected ? "Connected" : "Disconnected";
  toggleBtn.textContent = pending ? "Connecting…" : isConnected ? "Disconnect" : "Connect";
  toggleBtn.disabled = pending || (!hasEntitlement && !isConnected);
  if (!isConnected && !hasEntitlement && !pending) toggleBtn.textContent = "Choose a plan";
}

async function loadSessions() {
  const { data, error } = await supabaseClient.from("connection_sessions").select("id, started_at, ended_at").order("started_at", { ascending: false }).limit(5);
  if (error) { sessionList.innerHTML = "<li>Could not load sessions.</li>"; return; }
  sessionList.innerHTML = data.length ? data.map((session) => `<li><span>${new Date(session.started_at).toLocaleString()}</span><span>${session.ended_at ? "ended" : "active"}</span></li>`).join("") : "<li>No sessions yet.</li>";
  const open = data.find((session) => !session.ended_at);
  activeSessionId = open?.id || null;
  renderConnected(Boolean(open));
}

async function loadPlan() {
  const { data } = await supabaseClient.from("vpn_entitlements").select("plan, active, expires_at").eq("user_id", currentUser.id).maybeSingle();
  hasEntitlement = Boolean(data?.active && (!data.expires_at || new Date(data.expires_at) > new Date()));
  if (hasEntitlement) {
    planBadge.textContent = `${data.plan === "yearly" ? "Yearly" : "Monthly"} plan`;
    planBadge.classList.add("plan-active");
    planCopy.textContent = data.expires_at ? `Access is active through ${new Date(data.expires_at).toLocaleDateString()}.` : "Access is active.";
  }
}

async function syncBilling() {
  const { error } = await supabaseClient.functions.invoke("sync-billing-status");
  if (error) console.warn("Billing status could not be refreshed yet.");
}

toggleBtn.addEventListener("click", async () => {
  if (!activeSessionId && !hasEntitlement) { window.location.href = "pricing.html"; return; }
  renderConnected(Boolean(activeSessionId), true);
  const request = activeSessionId
    ? supabaseClient.from("connection_sessions").update({ ended_at: new Date().toISOString() }).eq("id", activeSessionId)
    : supabaseClient.from("connection_sessions").insert({ user_id: currentUser.id, server_location: "Ulaanbaatar, MN" });
  const { error } = await request;
  if (error) alert("We couldn't update the demo connection. Please try again.");
  await loadSessions();
});

manageBillingBtn.addEventListener("click", async () => {
  manageBillingBtn.disabled = true;
  const { data, error } = await supabaseClient.functions.invoke("create-billing-portal-session");
  manageBillingBtn.disabled = false;
  if (error || !data?.url) { alert("We couldn't open billing management. Subscribe first or try again shortly."); return; }
  window.location.assign(data.url);
});

logoutLink.addEventListener("click", async (event) => { event.preventDefault(); await supabaseClient.auth.signOut(); window.location.href = "auth.html"; });

(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = "auth.html"; return; }
  currentUser = session.user;
  userEmailEl.textContent = currentUser.email;
  await syncBilling();
  await Promise.all([loadSessions(), loadPlan()]);
})();
