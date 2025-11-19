export type PRStatus = "open" | "closed" | "merged";

export type PRLabel = "backend" | "frontend" | "infra" | "deps" | "security";

export interface PRSummary {
  tldr: string;
  risks: string[];       // e.g. ["security", "deps"]
  labels: PRLabel[];     // subset of ["backend","infra","deps","security","frontend"]
  createdAt: string;     // ISO string
}

export interface PRFileChange {
  filename: string;
  additions: number;
  deletions: number;
}

export interface PRDoc {
  _id: string;
  repoId: number;
  number: number;           // PR number
  title: string;
  author: string;
  branchFrom: string;
  branchTo: string;
  status: PRStatus;         // "open" | "closed" | "merged"
  filesChanged: PRFileChange[];
  summary?: PRSummary;
  slackMessageTs?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PRListResponse {
  items: PRDoc[];
  total: number;
  page: number;
  limit: number;
}

