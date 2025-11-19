import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { login as apiLogin, signup as apiSignup, getCurrentUser, refreshToken, AuthResponse, UserResponse } from "../api/auth";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Load user from token on mount
  useEffect(() => {
    const loadUser = async () => {
      const accessToken = localStorage.getItem("accessToken");
      const refreshTokenValue = localStorage.getItem("refreshToken");

      if (!accessToken || !refreshTokenValue) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (error) {
        // Token might be expired, try to refresh
        try {
          const response = await refreshToken({ refreshToken: refreshTokenValue });
          localStorage.setItem("accessToken", response.accessToken);
          localStorage.setItem("refreshToken", response.refreshToken);
          
          const userData = await getCurrentUser();
          setUser(userData);
        } catch (refreshError) {
          // Refresh failed, clear tokens
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response: AuthResponse = await apiLogin({ email, password });
    localStorage.setItem("accessToken", response.accessToken);
    localStorage.setItem("refreshToken", response.refreshToken);
    setUser(response.user);
  };

  const signup = async (email: string, password: string, name: string) => {
    const response: AuthResponse = await apiSignup({ email, password, name });
    localStorage.setItem("accessToken", response.accessToken);
    localStorage.setItem("refreshToken", response.refreshToken);
    setUser(response.user);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
  };

  const refreshAuth = async () => {
    const refreshTokenValue = localStorage.getItem("refreshToken");
    if (!refreshTokenValue) {
      logout();
      return;
    }

    try {
      const response = await refreshToken({ refreshToken: refreshTokenValue });
      localStorage.setItem("accessToken", response.accessToken);
      localStorage.setItem("refreshToken", response.refreshToken);
      
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, login, signup, logout, refreshAuth }}>
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

