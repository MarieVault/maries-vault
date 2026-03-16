import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

interface SplashProps {
  onComplete: () => void;
}

export default function Splash({ onComplete }: SplashProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { toggleTheme, getThemeIcon } = useTheme();
  const { login, isLoading } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => setShowForm(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(() => onComplete(), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const result = await login(username, password);
    if (result.success) {
      handleComplete();
    } else {
      setError(result.message);
      setPassword("");
    }
  };

  if (!isVisible) {
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-800 via-gray-800 to-gray-900 animate-fade-out" />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-800 via-gray-800 to-gray-900">
      <div className="text-center max-w-sm mx-auto px-6 w-full">
        {/* Vault door animation */}
        <div className="relative w-32 h-32 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-gray-400 bg-gradient-to-br from-gray-300 to-gray-500 shadow-2xl animate-vault-spin">
            <div className="absolute inset-4 rounded-full border-2 border-gray-600 bg-gradient-to-br from-gray-400 to-gray-600">
              <button
                onClick={toggleTheme}
                className="absolute inset-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center hover:from-red-300 hover:to-red-500 transition-colors cursor-pointer"
                title="Change theme"
              >
                <span className="text-white text-lg">{getThemeIcon()}</span>
              </button>
              <div className="absolute top-1/2 left-1/2 w-1 h-8 bg-gray-700 transform -translate-x-1/2 -translate-y-1/2 rotate-0"></div>
              <div className="absolute top-1/2 left-1/2 w-1 h-8 bg-gray-700 transform -translate-x-1/2 -translate-y-1/2 rotate-45"></div>
              <div className="absolute top-1/2 left-1/2 w-1 h-8 bg-gray-700 transform -translate-x-1/2 -translate-y-1/2 rotate-90"></div>
              <div className="absolute top-1/2 left-1/2 w-1 h-8 bg-gray-700 transform -translate-x-1/2 -translate-y-1/2 rotate-135"></div>
            </div>
          </div>
          <div className="absolute inset-0 rounded-full bg-red-400 opacity-20 animate-pulse-gentle"></div>
        </div>

        <button
          onClick={toggleTheme}
          className="text-3xl font-bold text-white mb-2 hover:text-gray-200 transition-colors cursor-pointer"
          title="Change theme"
        >
          MARIE'S VAULT
        </button>

        {!showForm ? (
          <p className="text-gray-300 text-sm animate-pulse-gentle">Unlocking memories...</p>
        ) : (
          <div className="mt-6">
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                disabled={isLoading}
                autoFocus
                autoComplete="username"
              />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                disabled={isLoading}
                autoComplete="current-password"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <Button
                type="submit"
                disabled={isLoading || !username || !password}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                {isLoading ? "Unlocking..." : "Unlock Vault"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
