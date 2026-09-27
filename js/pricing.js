const banner = document.getElementById("banner");
const showBanner = (text) => { banner.textContent = text; banner.style.display = "block"; };
document.querySelectorAll("[data-plan]").forEach((button) => button.addEventListener("click", async () => {
  const plan = button.dataset.plan;
  if (plan === "free") return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = "auth.html"; return; }
  button.disabled = true;
  const { error } = await supabaseClient.from("subscriptions").insert({ user_id: session.user.id, plan, status: "inactive" });
  button.disabled = false;
  showBanner(error ? "We couldn't record your interest. Please try again shortly." : `Noted — you’re interested in the ${plan} plan. Nothing has been charged.`);
}));

