import { Lock, LogOut } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

export default function Logo() {
  const { toggleTheme, getThemeIcon } = useTheme();
  const { logout, deviceInfo } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex items-center space-x-2">
      <button 
        onClick={toggleTheme}
        className="w-6 h-6 bg-gradient-to-br from-indigo-600 to-purple-600 rounded flex items-center justify-center hover:from-indigo-500 hover:to-purple-500 transition-colors cursor-pointer"
        title="Change theme"
      >
        <span className="text-white text-xs">{getThemeIcon()}</span>
      </button>
      <span className="font-semibold text-slate-800 text-sm">Marie's Vault</span>
      {deviceInfo && (
        <button
          onClick={handleLogout}
          className="w-6 h-6 bg-red-600 rounded flex items-center justify-center hover:bg-red-500 transition-colors cursor-pointer ml-2"
          title="Logout"
        >
          <LogOut size={12} className="text-white" />
        </button>
      )}
    </div>
  );
}
