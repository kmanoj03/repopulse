import { useNavigate } from "react-router-dom";
import { PRDoc, PRStatus } from "../types/contracts";

interface PRCardProps {
  pr: PRDoc;
}

export function PRCard({ pr }: PRCardProps) {
  const navigate = useNavigate();

  const statusColors: Record<PRStatus, string> = {
    open: "bg-green-100 text-green-800",
    merged: "bg-purple-100 text-purple-800",
    closed: "bg-gray-100 text-gray-800",
  };

  const totalAdditions = pr.filesChanged.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = pr.filesChanged.reduce((sum, file) => sum + file.deletions, 0);
  const totalFiles = pr.filesChanged.length;

  return (
    <div
      onClick={() => navigate(`/prs/${pr._id}`)}
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border border-gray-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {pr.title}
          </h3>
          <p className="text-sm text-gray-600">
            #{pr.number} by <span className="font-medium">{pr.author}</span>
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[pr.status]}`}>
          {pr.status}
        </span>
      </div>

      {pr.summary?.labels && pr.summary.labels.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {pr.summary.labels.map((label) => (
            <span
              key={label}
              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="text-sm text-gray-600">
        {totalFiles} file{totalFiles !== 1 ? "s" : ""} changed (+{totalAdditions} / −{totalDeletions})
      </div>
    </div>
  );
}

