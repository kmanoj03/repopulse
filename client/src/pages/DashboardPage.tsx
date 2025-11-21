import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useMe } from "../hooks/useMe";
import { GitHubAppConnectCard } from "../components/github/GitHubAppConnectCard";
import { useAuth } from "../context/AuthContext";
import { Header } from "../components/Header";
import { getPRs } from "../api/client";
import { Repository } from "../types/contracts";

export function DashboardPage() {
  const { user: authUser, isLoading: authLoading, refreshUser } = useAuth();
  const { user, hasInstallations, isLoading, refetch, error } = useMe();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [prsLoading, setPrsLoading] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('DashboardPage state:', {
      authUser: !!authUser,
      authLoading,
      user: !!user,
      hasInstallations,
      isLoading,
      error: error?.message,
    });
  }, [authUser, authLoading, user, hasInstallations, isLoading, error]);

  // Check for installation success query param (legacy support)
  useEffect(() => {
    const installed = searchParams.get("installed");
    if (installed === "1") {
      setShowSuccessToast(true);
      // Refetch user data to get updated installation status
      refetch();
      refreshUser(); // Also refresh AuthContext
      // Clear the query param
      window.history.replaceState({}, "", "/dashboard");
      // Hide toast after 5 seconds
      setTimeout(() => setShowSuccessToast(false), 5000);
    }
  }, [searchParams, refetch, refreshUser]);

  // Fetch PRs when user has installations
  useEffect(() => {
    if (hasInstallations && user) {
      const fetchPRs = async () => {
        setPrsLoading(true);
        try {
          const response = await getPRs({ page: 1, limit: 10 });
          setRepositories(response.data.repositories);
        } catch (error) {
          console.error("Failed to load PRs:", error);
        } finally {
          setPrsLoading(false);
        }
      };
      fetchPRs();
    }
  }, [hasInstallations, user]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !authUser) {
      navigate("/login");
    }
  }, [authLoading, authUser, navigate]);

  // Show loading state - wait for both auth and user data
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show error or redirect if not authenticated
  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Not authenticated</p>
          <button
            onClick={() => navigate("/login")}
            className="text-blue-600 hover:text-blue-800"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  // If user data is still loading or not available, show loading
  // This handles the case where authUser exists but useMe hasn't loaded yet
  if (!user && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading user data...</div>
      </div>
    );
  }

  // If there's an error loading user data, show error but still allow onboarding
  if (error && !user) {
    console.warn('Error loading user data, but authUser exists:', error);
    // If we have authUser, we can still show onboarding
    // The user might not have installations yet
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            ⚠️ Could not load user data. You can still install the GitHub App.
          </p>
        </div>
        <GitHubAppConnectCard />
      </div>
    );
  }

  // Show onboarding if no installations
  // hasInstallations comes from useMe hook which checks user.installationIds.length > 0
  if (!hasInstallations) {
    const handleInstallationComplete = () => {
      // Refetch user data and refresh auth context
      refetch();
      refreshUser();
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    };

    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        {showSuccessToast && (
          <div className="max-w-2xl mx-auto mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              <span className="font-semibold">🎉 Success!</span> GitHub App connected successfully
            </p>
          </div>
        )}
        <GitHubAppConnectCard onInstallationComplete={handleInstallationComplete} />
      </div>
    );
  }

  // Show dashboard with installations
  // At this point, user should be defined (we checked above), but TypeScript needs explicit check
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {showSuccessToast && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              <span className="font-semibold">🎉 Success!</span> GitHub App connected successfully
            </p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {user.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome, {user.username}
                </h1>
                <p className="text-gray-600">
                  Connected installations: {user.installationIds.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Pull Requests */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Pull Requests
            </h2>
            <Link
              to="/prs"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All →
            </Link>
          </div>

          {prsLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600 text-sm">Loading PRs...</p>
            </div>
          ) : repositories.length === 0 ? (
            <p className="text-gray-500 text-sm">No pull requests found</p>
          ) : (
            <div className="space-y-4">
              {repositories.slice(0, 3).map((repo) =>
                repo.prs.slice(0, 5).map((pr) => (
                  <Link
                    key={pr._id}
                    to={`/prs/${pr._id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">{pr.title}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              pr.status === "open"
                                ? "bg-green-100 text-green-800"
                                : pr.status === "merged"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {pr.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {pr.repoFullName} #{pr.number} by {pr.author}
                        </p>
                        {pr.summary && pr.summary.tldr && (
                          <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                            {pr.summary.tldr}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* Repository Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {repositories.slice(0, 3).map((repo) => {
            const openPRs = repo.prs.filter((pr) => pr.status === "open").length;
            const totalPRs = repo.prs.length;
            return (
              <Link
                key={repo.repoId}
                to={`/repos/${repo.repoId}/prs`}
                className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {repo.repoFullName}
                </h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Total PRs: {totalPRs}</p>
                  <p>Open PRs: {openPRs}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

