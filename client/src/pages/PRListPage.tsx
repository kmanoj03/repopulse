import { useState, useEffect } from "react";
import { getPRs, GetPRsParams } from "../api/client";
import { PRDoc } from "../types/contracts";
import { PRCard } from "../components/PRCard";
import { PRLabel } from "../types/contracts";

export function PRListPage() {
  const [prs, setPRs] = useState<PRDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [labelFilter, setLabelFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const labels: PRLabel[] = ["backend", "frontend", "infra", "deps", "security"];

  // Debounce search query, but update other filters immediately
  useEffect(() => {
    const fetchPRs = async () => {
      setLoading(true);
      try {
        const params: GetPRsParams = {
          status: statusFilter !== "all" ? statusFilter : undefined,
          label: labelFilter || undefined,
          q: searchQuery || undefined,
          page,
          limit,
        };
        const response = await getPRs(params);
        setPRs(response.items);
        setTotal(response.total);
      } catch (error) {
        console.error("Failed to load PRs:", error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchPRs();
    }, searchQuery ? 300 : 0); // Debounce only if there's a search query

    return () => clearTimeout(timer);
  }, [statusFilter, labelFilter, searchQuery, page, limit]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Pull Requests</h1>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="space-y-4">
            {/* Search */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                id="search"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by title or author..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="merged">Merged</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Label Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Labels
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setLabelFilter("");
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    labelFilter === ""
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  All
                </button>
                {labels.map((label) => (
                  <button
                    key={label}
                    onClick={() => {
                      setLabelFilter(label);
                      setPage(1);
                    }}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      labelFilter === label
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {prs.map((pr) => (
                <PRCard key={pr._id} pr={pr} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

