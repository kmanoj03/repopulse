import { useNavigate } from "react-router-dom";
import { PRDoc, PRStatus } from "../types/contracts";

interface PRCardProps {
  pr: PRDoc;
}

/**
 * Test file with issues similar to PRCard.tsx
 * Issues: Missing null checks, unsafe property access, missing error boundaries
 */
export function testPRCard({ pr }: PRCardProps) {
  const navigate = useNavigate();

  // Issue: No null check - statusColors might not have all status values
  const statusColors: Record<PRStatus, string> = {
    open: "bg-green-100 text-green-800",
    merged: "bg-purple-100 text-purple-800",
    closed: "bg-gray-100 text-gray-800",
  };

  // Issue: No check if filesChanged array exists or is empty
  const totalAdditions = pr.filesChanged.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = pr.filesChanged.reduce((sum, file) => sum + file.deletions, 0);
  const totalFiles = pr.filesChanged.length;

  // Issue: Accessing summary.labels without checking if summary exists
  const hasLabels = pr.summary.labels && pr.summary.labels.length > 0;
  
  // Issue: No null check before mapping
  const labelElements = pr.summary.labels.map((label) => (
    <span key={label}>{label}</span>
  ));

  // Issue: Accessing _id without checking if it exists
  const handleClick = () => {
    navigate(`/prs/${pr._id}`);
  };

  return (
    <div onClick={handleClick} className="bg-white rounded-lg shadow-md p-6">
      <h3>{pr.title}</h3>
      
      {/* Issue: No check if summary exists before accessing properties */}
      {pr.summary.labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {labelElements}
        </div>
      )}
      
      {/* Issue: Accessing nested property without null check */}
      <div className="text-sm">
        {pr.summary.tldr.substring(0, 100)}
      </div>
      
      {/* Issue: No check if risks array exists */}
      {pr.summary.risks.length > 0 && (
        <div className="text-red-600">
          Risks: {pr.summary.risks.join(', ')}
        </div>
      )}
      
      <div className="text-sm">
        {totalFiles} files changed (+{totalAdditions} / −{totalDeletions})
      </div>
    </div>
  );
}

/**
 * Test component with missing error handling
 */
export function testPRList({ prs }: { prs: PRDoc[] }) {
  // Issue: No check if prs is null or undefined
  const sortedPRs = prs.sort((a, b) => {
    // Issue: No null check - createdAt might not exist
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Issue: Accessing properties without validation
  const firstPR = sortedPRs[0];
  const firstPRTitle = firstPR.title;
  const firstPRAuthor = firstPR.author;

  return (
    <div>
      <h2>Pull Requests</h2>
      {sortedPRs.map((pr) => (
        <div key={pr._id}>
          {/* Issue: No check if summary exists */}
          <p>{pr.summary.tldr}</p>
          
          {/* Issue: Accessing nested array without check */}
          {pr.summary.risks.map((risk) => (
            <span key={risk}>{risk}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

