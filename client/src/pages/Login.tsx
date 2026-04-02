import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [mode, setMode] = useState<"login" | "register">(
    params.get("mode") === "register" ? "register" : "login"
  );
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  if (isAuthenticated) {
    navigate("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "register" && !ageConfirmed) {
      setError("You must confirm you are 18 or older to create an account.");
      setLoading(false);
      return;
    }

    if (mode === "register") {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, email, password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Registration failed"); setLoading(false); return; }
        await login(username, password);
        navigate("/");
      } catch {
        setError("Something went wrong");
      }
    } else {
      const result = await login(username, password);
      if (result.success) {
        navigate("/");
      } else {
        setError(result.message);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "linear-gradient(160deg, #fce4ec 0%, #f8bbd0 50%, #fce4ec 100%)" }}>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black leading-tight" style={{ color: "#c2185b" }}>
          Marie's<br />Vault
        </h1>
        <p className="mt-3 text-sm" style={{ color: "#ad1457" }}>
          {mode === "register"
            ? "Create your free account"
            : "Welcome back"}
        </p>
        {mode === "register" && (
          <p className="text-xs mt-1" style={{ color: "#c2185b", opacity: 0.7 }}>
            Save entries and rate your favourites. Always free.
          </p>
        )}
      </div>

      {/* Form */}
      <div className="w-full max-w-sm space-y-3">
        <Input
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          autoComplete="username"
          className="h-14 rounded-2xl border-2 bg-white text-base px-5"
          style={{ borderColor: "#f48fb1" }}
        />
        {mode === "register" && (
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="h-14 rounded-2xl border-2 bg-white text-base px-5"
            style={{ borderColor: "#f48fb1" }}
          />
        )}
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="h-14 rounded-2xl border-2 bg-white text-base px-5"
          style={{ borderColor: "#f48fb1" }}
        />

        {mode === "register" && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={e => setAgeConfirmed(e.target.checked)}
              className="mt-0.5 shrink-0 accent-pink-600"
            />
            <span className="text-xs leading-snug" style={{ color: "#ad1457" }}>
              I confirm I am 18 years of age or older and agree to the{" "}
              <a href="/terms" target="_blank" className="underline">Terms of Service</a>
            </span>
          </label>
        )}

        {error && (
          <p className="text-sm text-center py-2 px-4 rounded-xl"
            style={{ color: "#b71c1c", background: "rgba(183,28,28,0.08)" }}>
            {error}
          </p>
        )}

        <Button
          type="button"
          onClick={handleSubmit as any}
          disabled={loading || (mode === "register" && !ageConfirmed)}
          className="w-full h-14 rounded-2xl text-base font-bold text-white shadow-lg"
          style={{ background: "#c2185b" }}
        >
          {loading ? "..." : mode === "login" ? "Sign In ✨" : "Create account ✨"}
        </Button>
      </div>

      {/* Footer links */}
      <div className="mt-6 text-center space-y-3">
        <button
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          className="text-sm font-medium underline"
          style={{ color: "#ad1457" }}
        >
          {mode === "login" ? "New here? Create a free account" : "Already have an account? Sign in"}
        </button>
        <div>
          <button
            onClick={() => navigate("/")}
            className="text-xs"
            style={{ color: "#c2185b", opacity: 0.6 }}
          >
            Continue browsing without an account →
          </button>
        </div>
      </div>
    </div>
  );
}
