import { PRDoc } from "../types/contracts";

interface PRCardProps {
  pr: PRDoc;
}

/**
 * Test file with minimal issues - low risk score
 * Issues: Subtle type handling, minor optimization opportunities
 */
export function testPRCard({ pr }: PRCardProps) {
  // Minor issue: Could use optional chaining for summary access
  // Current code works but could be more defensive
  const hasSummary = pr.summary && pr.summary.tldr;
  
  // Minor issue: filesChanged might be empty, but reduce handles it
  const totalAdditions = pr.filesChanged.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = pr.filesChanged.reduce((sum, file) => sum + file.deletions, 0);
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold">{pr.title}</h3>
      
      {hasSummary && (
        <p className="text-sm text-gray-600 mt-2">
          {pr.summary.tldr}
        </p>
      )}
      
      <div className="text-sm text-gray-500 mt-4">
        {pr.filesChanged.length} file{pr.filesChanged.length !== 1 ? 's' : ''} changed 
        (+{totalAdditions} / −{totalDeletions})
      </div>
    </div>
  );
}

