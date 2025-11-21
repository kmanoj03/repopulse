const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export interface UserInfo {
  id: string;
  githubId: number;
  username: string;
  email: string;
  avatarUrl: string;
  role: string;
  installationIds: number[];
}

export interface MeResponse {
  user: UserInfo;
  hasInstallations: boolean;
}

/**
 * Get current user information
 */
export async function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>("/api/me");
}

