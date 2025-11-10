import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  deviceInfo: {
    isIPhone: boolean;
    isSafari: boolean;
    fingerprint: string;
  } | null;
  login: (passcode: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceInfo, setDeviceInfo] = useState<AuthContextType['deviceInfo']>(null);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/status", {
        credentials: "include",
      });
      const data = await response.json();
      
      setIsAuthenticated(data.authenticated);
      setDeviceInfo(data.deviceInfo || null);
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsAuthenticated(false);
      setDeviceInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (passcode: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ passcode }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAuthenticated(true);
        setDeviceInfo(data.deviceInfo);
        // Clear any existing splash completion flag since we have real auth now
        localStorage.removeItem('splashCompleted');
      }

      return {
        success: data.success,
        message: data.message
      };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        message: "Network error occurred"
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsAuthenticated(false);
      setDeviceInfo(null);
      setIsLoading(false);
      // Clear localStorage flag
      localStorage.removeItem('splashCompleted');
    }
  };

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        deviceInfo,
        login,
        logout,
        checkAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}