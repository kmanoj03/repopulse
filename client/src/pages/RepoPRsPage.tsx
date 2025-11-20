import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPRs, GetPRsParams } from "../api/client";
import { PRDoc } from "../types/contracts";
import { PRCard } from "../components/PRCard";
import { Header } from "../components/Header";

export function RepoPRsPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const [prs, setPRs] = useState<PRDoc[]>([]);
  const [repoFullName, setRepoFullName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const fetchPRs = async () => {
      setLoading(true);
      try {
        const params: GetPRsParams = {
          repoId,
          status: statusFilter !== "all" ? statusFilter : undefined,
        };
        const response = await getPRs(params);
        
        // Find the repository that matches our repoId
        const repo = response.data.repositories.find(r => r.repoId === repoId);
        if (repo) {
          setRepoFullName(repo.repoFullName);
          setPRs(repo.prs);
        } else {
          setPRs([]);
        }
      } catch (error) {
        console.error("Failed to load PRs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPRs();
  }, [repoId, statusFilter]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate("/prs")}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to All Repositories
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">{repoFullName}</h1>
        <p className="text-gray-600 mb-6">{prs.length} Pull Requests</p>

        {/* Status Filter */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="merged">Merged</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* PR List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading PRs...</p>
          </div>
        ) : prs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600 text-lg">No pull requests found</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {prs.map((pr) => (
              <PRCard key={pr._id} pr={pr} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

