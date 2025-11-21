import { useSearchParams, useNavigate } from "react-router-dom";

export function ErrorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reason = searchParams.get("reason");

  const getErrorMessage = () => {
    switch (reason) {
      case "missing_params":
        return "Missing required parameters. Please try installing the GitHub App again.";
      case "invalid_state":
        return "Invalid or expired security token. Please try installing the GitHub App again.";
      case "user_not_found":
        return "User not found. Please log in again.";
      case "invalid_installation_id":
        return "Invalid installation ID. Please try installing the GitHub App again.";
      case "github_api_error":
        return "Failed to communicate with GitHub. Please try again later.";
      case "setup_failed":
        return "Setup failed. Please try installing the GitHub App again.";
      default:
        return "An error occurred during GitHub App setup.";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Error</h1>
          <p className="text-gray-600 mb-6">{getErrorMessage()}</p>
          <div className="space-y-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

