import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser, isAuthenticated, isLoading } = useAuth();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState("");
  const [tokenStored, setTokenStored] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setErrorMessage("No authentication token received");
      setTimeout(() => navigate("/login?error=no_token"), 2000);
      return;
    }

    try {
      // Store the JWT token
      localStorage.setItem("accessToken", token);
      setTokenStored(true);
      
      // Refresh user data from AuthContext (this will call /api/me)
      refreshUser().then(() => {
        setStatus("success");
      }).catch((error) => {
        console.error("Failed to refresh user:", error);
        setStatus("error");
        setErrorMessage("Failed to authenticate. Please try again.");
        setTimeout(() => navigate("/login?error=auth_failed"), 2000);
      });
    } catch (error) {
      setStatus("error");
      setErrorMessage("Failed to save authentication token");
      setTimeout(() => navigate("/login?error=token_save_failed"), 2000);
    }
  }, [searchParams, navigate, refreshUser]);

  // Wait for AuthContext to finish loading user before redirecting
  useEffect(() => {
    if (!isLoading && isAuthenticated && status === "success" && tokenStored) {
      // User is now authenticated, redirect to dashboard
      navigate("/dashboard", { replace: true });
    } else if (!isLoading && !isAuthenticated && status === "success" && tokenStored) {
      // Token was saved but user didn't load - might be invalid token
      setStatus("error");
      setErrorMessage("Failed to authenticate. Please try again.");
      setTimeout(() => navigate("/login?error=auth_failed"), 2000);
    }
  }, [isLoading, isAuthenticated, status, navigate, tokenStored]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md text-center">
        {status === "processing" && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4 animate-pulse">
              <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Completing Sign In</h2>
            <p className="text-gray-600">Please wait while we set up your account...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600">Redirecting to your dashboard...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <p className="text-sm text-gray-500">Redirecting to login page...</p>
          </>
        )}
      </div>
    </div>
  );
}

