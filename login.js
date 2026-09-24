(function () {
  const form = document.getElementById("login-form");
  const errEl = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");
  const btnText = btn.querySelector(".btn-text");
  const btnSpinner = btn.querySelector(".btn-spinner");
  const pwInput = document.getElementById("login-password");
  const togglePw = document.getElementById("toggle-password");

  // Already logged in?
  if (localStorage.getItem("routeai_token") && localStorage.getItem("routeai_user")) {
    window.location.href = "app.html";
    return;
  }

  // Show / hide password
  if (togglePw && pwInput) {
    togglePw.addEventListener("click", () => {
      const isHidden = pwInput.type === "password";
      pwInput.type = isHidden ? "text" : "password";
      togglePw.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
      togglePw.title = isHidden ? "Hide password" : "Show password";
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.classList.add("hidden");
    btn.disabled = true;
    btnText.textContent = "Signing in…";
    btnSpinner.classList.remove("hidden");

    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid credentials");

      localStorage.setItem("routeai_token", data.token);
      localStorage.setItem("routeai_user", JSON.stringify(data.user));
      window.location.href = "app.html";
    } catch (err) {
      errEl.textContent = err.message || "Unable to sign in. Please try again.";
      errEl.classList.remove("hidden");
      btn.disabled = false;
      btnText.textContent = "Sign in";
      btnSpinner.classList.add("hidden");
    }
  });
})();
