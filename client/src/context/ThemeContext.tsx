import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Theme = "neutral" | "babydoll" | "girly" | "easter";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  getThemeIcon: () => string;
  getThemeColors: () => {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const themes: Record<Theme, { icon: string; colors: any }> = {
  neutral: {
    icon: "🔒",
    colors: {
      background: "0 0% 100%",
      foreground: "220 14% 4%",
      card: "0 0% 100%",
      primary: "220 14% 11%",
      secondary: "220 14% 96%",
      accent: "220 14% 96%",
      muted: "220 14% 96%",
      border: "220 13% 91%"
    }
  },
  babydoll: {
    icon: "👗",
    colors: {
      background: "210 100% 98%",
      foreground: "220 14% 4%",
      card: "210 100% 100%",
      primary: "210 100% 50%",
      secondary: "210 100% 90%",
      accent: "210 100% 90%",
      muted: "210 100% 95%",
      border: "210 100% 85%"
    }
  },
  girly: {
    icon: "🍼",
    colors: {
      background: "330 50% 98%",
      foreground: "220 14% 4%",
      card: "330 100% 100%",
      primary: "330 100% 50%",
      secondary: "330 100% 90%",
      accent: "330 100% 90%",
      muted: "330 100% 95%",
      border: "330 100% 85%"
    }
  },
  easter: {
    icon: "🥚",
    colors: {
      background: "120 30% 98%",
      foreground: "220 14% 4%",
      card: "0 0% 100%",
      primary: "280 100% 60%",
      secondary: "60 100% 90%",
      accent: "120 40% 90%",
      muted: "120 40% 95%",
      border: "120 40% 85%"
    }
  }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("neutral");

  useEffect(() => {
    const savedTheme = localStorage.getItem("vault-theme") as Theme;
    if (savedTheme && themes[savedTheme]) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("vault-theme", theme);
    
    // Apply theme colors to CSS variables
    const colors = themes[theme].colors;
    const root = document.documentElement;
    
    root.style.setProperty("--background", colors.background);
    root.style.setProperty("--foreground", colors.foreground);
    root.style.setProperty("--card", colors.card);
    root.style.setProperty("--card-foreground", colors.foreground);
    root.style.setProperty("--popover", colors.card);
    root.style.setProperty("--popover-foreground", colors.foreground);
    root.style.setProperty("--primary", colors.primary);
    root.style.setProperty("--primary-foreground", "210 40% 98%");
    root.style.setProperty("--secondary", colors.secondary);
    root.style.setProperty("--secondary-foreground", colors.foreground);
    root.style.setProperty("--muted", colors.muted);
    root.style.setProperty("--muted-foreground", "215 16% 47%");
    root.style.setProperty("--accent", colors.accent);
    root.style.setProperty("--accent-foreground", colors.foreground);
    root.style.setProperty("--border", colors.border);
    root.style.setProperty("--input", colors.border);
    root.style.setProperty("--ring", colors.primary);
  }, [theme]);

  const toggleTheme = () => {
    const themeOrder: Theme[] = ["neutral", "babydoll", "girly", "easter"];
    const currentIndex = themeOrder.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    setTheme(themeOrder[nextIndex]);
  };

  const getThemeIcon = () => themes[theme].icon;
  const getThemeColors = () => themes[theme].colors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, getThemeIcon, getThemeColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}