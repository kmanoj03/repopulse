import { useState, useEffect } from "react";
import { getMe, UserInfo, MeResponse } from "../api/me";

interface UseMeReturn {
  user: UserInfo | null;
  hasInstallations: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage current user information
 * Returns user data, installation status, loading state, and error
 */
export function useMe(): UseMeReturn {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [hasInstallations, setHasInstallations] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMe = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getMe();
      setUser(data.user);
      setHasInstallations(data.hasInstallations);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      setError(error);
      setUser(null);
      setHasInstallations(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  return {
    user,
    hasInstallations,
    isLoading,
    error,
    refetch: fetchMe,
  };
}

