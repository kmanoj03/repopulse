import { useEffect } from "react";

interface RiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  flag: string;
  files: Array<{ filename: string; additions: number; deletions: number }>;
  reason: string;
}

export function RiskModal({ isOpen, onClose, flag, files, reason }: RiskModalProps) {
  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-start pt-20 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-xl shadow-xl mx-4 mb-20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-xl font-semibold text-gray-900">
              {flag}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Reason */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Why This Was Flagged
            </h3>
            <p className="text-gray-900 leading-relaxed bg-amber-50 p-4 rounded-lg border border-amber-200">
              {reason}
            </p>
          </div>

          {/* Files */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Files That Triggered This Risk ({files.length})
            </h3>
            
            {files.length === 0 ? (
              <p className="text-gray-500 text-sm italic">No specific files identified</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {files.map((file, idx) => (
                  <div 
                    key={idx}
                    className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-gray-900 break-all">
                          {file.filename}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                        <span className="text-green-600 font-medium">
                          +{file.additions}
                        </span>
                        <span className="text-red-600 font-medium">
                          −{file.deletions}
                        </span>
                      </div>
                    </div>
                    
                    {/* File extension badge */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {file.filename.split('.').pop()?.toUpperCase() || 'FILE'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {file.additions + file.deletions} changes
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              <strong>💡 Tip:</strong> This risk was detected using automated analysis. 
              Review the changed files carefully before merging.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

