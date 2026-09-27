const banner = document.getElementById("banner");
const showBanner = (text) => { banner.textContent = text; banner.style.display = "block"; };
document.querySelectorAll("[data-plan]").forEach((button) => button.addEventListener("click", async () => {
  const plan = button.dataset.plan;
  if (plan === "free") return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = "auth.html"; return; }
  button.disabled = true;
  const { data, error } = await supabaseClient.functions.invoke("create-checkout-session", { body: { plan } });
  button.disabled = false;
  if (error || !data?.url) { showBanner("We couldn't start secure checkout. Please try again shortly."); return; }
  window.location.assign(data.url);
}));
