import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface BlurContextType {
  blurEnabled: boolean;
  toggleBlur: () => void;
}

const BlurContext = createContext<BlurContextType | undefined>(undefined);

export function useBlur() {
  const ctx = useContext(BlurContext);
  if (!ctx) throw new Error("useBlur must be used within BlurProvider");
  return ctx;
}

export function BlurProvider({ children }: { children: ReactNode }) {
  const [blurEnabled, setBlurEnabled] = useState(() => {
    // Default on; user can turn off and it sticks
    const stored = localStorage.getItem("vault_blur");
    return stored === null ? true : stored === "true";
  });

  const toggleBlur = () => {
    setBlurEnabled(prev => {
      const next = !prev;
      localStorage.setItem("vault_blur", String(next));
      return next;
    });
  };

  return (
    <BlurContext.Provider value={{ blurEnabled, toggleBlur }}>
      {children}
    </BlurContext.Provider>
  );
}
