export type PRStatus = "open" | "closed" | "merged";

export type PRLabel = "backend" | "frontend" | "infra" | "deps" | "security";

export interface PRSummary {
  tldr: string;
  risks: string[];       // e.g. ["security", "deps"]
  labels: string[];      // Array of label strings (matches Mongoose model)
  createdAt: string;     // ISO string (Date in backend, string in frontend)
}

export interface PRFileChange {
  filename: string;
  additions: number;
  deletions: number;
}

export type SummaryStatus = "pending" | "ready" | "error";

export interface DiffStats {
  totalAdditions: number;
  totalDeletions: number;
  changedFilesCount: number;
}

export interface PRDoc {
  _id: string;              // MongoDB _id as string
  repoId: string;           // Changed from number to string to match Mongoose model
  repoFullName: string;     // Added to match Mongoose model
  number: number;           // PR number
  title: string;
  author: string;
  branchFrom: string;
  branchTo: string;
  status: string;           // "open" | "closed" | "merged" (matches Mongoose enum)
  filesChanged: PRFileChange[];
  summary: PRSummary | null; // Nullable - will be populated when summary is generated
  summaryStatus: SummaryStatus; // "pending" | "ready" | "error"
  summaryError: string | null;  // Error message if summary generation failed
  lastSummarizedAt: string | null; // ISO string (Date in backend, string in frontend)
  systemLabels?: string[];  // Deterministic labels from analysis
  riskFlags?: string[];     // Risk flags from analysis
  riskScore?: number;       // Risk score (0-100)
  diffStats?: DiffStats;    // Diff statistics
  slackMessageTs: string | null;  // Changed from optional to string | null
  createdAt: string;        // ISO string (Date in backend, string in frontend)
  updatedAt: string;        // ISO string (Date in backend, string in frontend)
}

export interface Repository {
  repoFullName: string;
  repoId: string;
  prs: PRDoc[];
}

export interface PRListResponse {
  success: boolean;
  data: {
    repositories: Repository[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

