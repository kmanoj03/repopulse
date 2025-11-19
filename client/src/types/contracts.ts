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
  summary: PRSummary;       // Required (not optional) to match Mongoose model
  slackMessageTs: string | null;  // Changed from optional to string | null
  createdAt: string;        // ISO string (Date in backend, string in frontend)
  updatedAt: string;        // ISO string (Date in backend, string in frontend)
}

export interface PRListResponse {
  items: PRDoc[];
  total: number;
  page: number;
  limit: number;
}

