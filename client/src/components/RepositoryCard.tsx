import { useNavigate } from "react-router-dom";

interface RepositoryCardProps {
  repoFullName: string;
  repoId: string;
  prCount: number;
  openCount: number;
  author: string;
}

export function RepositoryCard({ repoFullName, repoId, prCount, openCount, author }: RepositoryCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/repos/${repoId}/prs`)}
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-blue-600"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {repoFullName}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            by {author}
          </p>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold">
                {prCount}
              </span>
              <span className="text-gray-600">
                {prCount === 1 ? 'Pull Request' : 'Pull Requests'}
              </span>
            </div>
            
            {openCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {openCount} Open
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="ml-4">
          <svg 
            className="w-6 h-6 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 5l7 7-7 7" 
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

