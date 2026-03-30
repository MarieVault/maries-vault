import { useState, useEffect } from "react";
import { X, EyeOff, Grid3X3, Bookmark } from "lucide-react";

export default function HintBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("vault_hint_dismissed");
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem("vault_hint_dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mx-4 mt-2 mb-1 bg-pink-50 border border-pink-200 rounded-xl px-4 py-3 text-xs text-pink-800 flex items-start gap-3 shadow-sm">
      <div className="flex-1 space-y-1.5">
        <p className="font-semibold text-pink-700 mb-1">Quick guide 👋</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5">
            <span className="text-sm leading-none">🎲</span> Roll a random entry
          </span>
          <span className="flex items-center gap-1.5">
            <EyeOff size={13} className="shrink-0" /> Toggle image blur
          </span>
          <span className="flex items-center gap-1.5">
            <Grid3X3 size={13} className="shrink-0" /> Switch to feed view
          </span>
          <span className="flex items-center gap-1.5">
            <Bookmark size={13} className="shrink-0" /> Save to your vault
          </span>
        </div>
      </div>
      <button onClick={dismiss} className="text-pink-400 hover:text-pink-600 shrink-0 mt-0.5" aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
