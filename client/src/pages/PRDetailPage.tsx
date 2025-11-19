import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPR, regenerateSummary } from "../api/client";
import { PRDoc } from "../types/contracts";
import { ToastMessage } from "../components/ToastContainer";
import { Header } from "../components/Header";

interface PRDetailPageProps {
  onToast: (toast: ToastMessage) => void;
}

export function PRDetailPage({ onToast }: PRDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pr, setPR] = useState<PRDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchPR = async () => {
      setLoading(true);
      try {
        const data = await getPR(id);
        setPR(data);
      } catch (error) {
        console.error("Failed to load PR:", error);
        onToast({
          id: Date.now().toString(),
          message: "Failed to load PR",
          type: "error",
        });
        navigate("/prs");
      } finally {
        setLoading(false);
      }
    };

    fetchPR();
  }, [id, navigate, onToast]);

  const handleRegenerateSummary = async () => {
    if (!id) return;

    setRegenerating(true);
    try {
      await regenerateSummary(id);
      onToast({
        id: Date.now().toString(),
        message: "Summary regeneration queued",
        type: "success",
      });

      // Re-fetch PR to show updated summary
      const updatedPR = await getPR(id);
      setPR(updatedPR);
    } catch (error) {
      console.error("Failed to regenerate summary:", error);
      onToast({
        id: Date.now().toString(),
        message: "Failed to regenerate summary",
        type: "error",
      });
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading PR...</p>
        </div>
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">PR not found</p>
          <button
            onClick={() => navigate("/prs")}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Back to PR List
          </button>
        </div>
      </div>
    );
  }

  const statusColors: Record<PRDoc["status"], string> = {
    open: "bg-green-100 text-green-800",
    merged: "bg-purple-100 text-purple-800",
    closed: "bg-gray-100 text-gray-800",
  };

  const riskColors: Record<string, string> = {
    security: "bg-red-100 text-red-800",
    deps: "bg-yellow-100 text-yellow-800",
    default: "bg-orange-100 text-orange-800",
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                PR #{pr.number} – {pr.title}
              </h1>
              <p className="text-gray-600">
                by <span className="font-medium">{pr.author}</span>
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[pr.status]}`}>
              {pr.status}
            </span>
          </div>

          <div className="text-sm text-gray-600">
            <span className="font-medium">{pr.branchFrom}</span> →{" "}
            <span className="font-medium">{pr.branchTo}</span>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Summary</h2>
            <button
              onClick={handleRegenerateSummary}
              disabled={regenerating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {regenerating ? "Regenerating..." : "Regenerate Summary"}
            </button>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">TL;DR</h3>
            <p className="text-gray-900">{pr.summary.tldr}</p>
          </div>

          {pr.summary.risks.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Risks</h3>
              <div className="flex flex-wrap gap-2">
                {pr.summary.risks.map((risk) => (
                  <span
                    key={risk}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      riskColors[risk] || riskColors.default
                    }`}
                  >
                    {risk}
                  </span>
                ))}
              </div>
            </div>
          )}

          {pr.summary.labels.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Labels</h3>
              <div className="flex flex-wrap gap-2">
                {pr.summary.labels.map((label) => (
                  <span
                    key={label}
                    className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500">
            Summary generated at {formatDate(pr.summary.createdAt)}
          </div>
        </div>

        {/* Files Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Files Changed</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Filename
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Additions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deletions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pr.filesChanged.map((file, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {file.filename}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                      +{file.additions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                      −{file.deletions}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Total
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                    +{pr.filesChanged.reduce((sum, f) => sum + f.additions, 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                    −{pr.filesChanged.reduce((sum, f) => sum + f.deletions, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6">
          <button
            onClick={() => navigate("/prs")}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to PR List
          </button>
        </div>
      </div>
    </div>
  );
}

