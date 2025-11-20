import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  userId: string;
  githubId: number;
  username: string;
  installationId: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Decode JWT to get user info (without verification - server already verified it)
function decodeJWT(token: string): User | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    
    // Check if token is expired
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }
    
    return {
      userId: payload.userId,
      githubId: payload.githubId,
      username: payload.username,
      installationId: payload.installationId,
    };
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Load user from token on mount
  useEffect(() => {
    const loadUser = () => {
      const accessToken = localStorage.getItem("accessToken");

      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      const userData = decodeJWT(accessToken);
      
      if (!userData) {
        // Token is invalid or expired
        localStorage.removeItem("accessToken");
        setIsLoading(false);
        return;
      }

      setUser(userData);
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const logout = () => {
    localStorage.removeItem("accessToken");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, logout }}>
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

