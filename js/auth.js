let mode = "login";

const tabs = document.querySelectorAll(".tab");
const submitBtn = document.getElementById("submit-btn");
const form = document.getElementById("auth-form");
const msg = document.getElementById("form-msg");

tabs.forEach((tab) => tab.addEventListener("click", () => {
  tabs.forEach((item) => item.classList.remove("active"));
  tab.classList.add("active");
  mode = tab.dataset.mode;
  submitBtn.textContent = mode === "login" ? "Log in" : "Create account";
  msg.textContent = "";
  msg.className = "form-msg";
}));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  submitBtn.disabled = true;
  msg.textContent = "";
  try {
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10) {
      throw new Error("Use a valid email and a password with at least 10 characters.");
    }
    if (mode === "signup") {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: new URL("dashboard.html", window.location.href).href },
      });
      if (error) throw error;
      if (data.session) window.location.href = "dashboard.html";
      else msg.textContent = "Account created. Check your email to confirm, then log in.";
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = "dashboard.html";
    }
    msg.className = "form-msg success";
  } catch (error) {
    msg.textContent = error.message || "Something went wrong.";
    msg.className = "form-msg error";
  } finally { submitBtn.disabled = false; }
});

(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) window.location.href = "dashboard.html";
})();
