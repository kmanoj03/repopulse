import { PRListResponse, PRDoc } from "../types/contracts";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Mock data - in-memory array of PRs (matches Mongoose model structure)
const mockPRs: PRDoc[] = [
  {
    _id: "1",
    repoId: "12345",
    repoFullName: "acme/repopulse",
    number: 42,
    title: "Add authentication middleware",
    author: "alice",
    branchFrom: "feature/auth",
    branchTo: "main",
    status: "open",
    filesChanged: [
      { filename: "src/middleware/auth.ts", additions: 150, deletions: 0 },
      { filename: "src/utils/token.ts", additions: 80, deletions: 10 },
      { filename: "tests/auth.test.ts", additions: 200, deletions: 5 },
    ],
    summary: {
      tldr: "Implements JWT-based authentication middleware with token validation and refresh logic. Adds comprehensive test coverage.",
      risks: ["security"],
      labels: ["backend", "security"],
      createdAt: "2024-01-15T10:30:00Z",
    },
    slackMessageTs: null,
    createdAt: "2024-01-15T09:00:00Z",
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    _id: "2",
    repoId: "12345",
    repoFullName: "acme/repopulse",
    number: 41,
    title: "Update React dependencies",
    author: "bob",
    branchFrom: "chore/deps",
    branchTo: "main",
    status: "merged",
    filesChanged: [
      { filename: "package.json", additions: 5, deletions: 5 },
      { filename: "package-lock.json", additions: 1200, deletions: 1100 },
    ],
    summary: {
      tldr: "Updates React from 18.1.0 to 18.2.0 and related dependencies. No breaking changes expected.",
      risks: ["deps"],
      labels: ["frontend", "deps"],
      createdAt: "2024-01-14T14:20:00Z",
    },
    slackMessageTs: "1234567890.123456",
    createdAt: "2024-01-14T12:00:00Z",
    updatedAt: "2024-01-14T15:00:00Z",
  },
  {
    _id: "3",
    repoId: "12345",
    repoFullName: "acme/repopulse",
    number: 40,
    title: "Configure CI/CD pipeline",
    author: "charlie",
    branchFrom: "feature/ci",
    branchTo: "main",
    status: "open",
    filesChanged: [
      { filename: ".github/workflows/ci.yml", additions: 200, deletions: 0 },
      { filename: ".github/workflows/deploy.yml", additions: 150, deletions: 0 },
    ],
    summary: {
      tldr: "Sets up GitHub Actions workflows for continuous integration and deployment. Includes automated testing and staging deployment.",
      risks: [],
      labels: ["infra"],
      createdAt: "2024-01-13T16:45:00Z",
    },
    slackMessageTs: null,
    createdAt: "2024-01-13T14:00:00Z",
    updatedAt: "2024-01-13T16:45:00Z",
  },
  {
    _id: "4",
    repoId: "12345",
    repoFullName: "acme/repopulse",
    number: 39,
    title: "Fix SQL injection vulnerability",
    author: "alice",
    branchFrom: "fix/security",
    branchTo: "main",
    status: "closed",
    filesChanged: [
      { filename: "src/db/queries.ts", additions: 30, deletions: 50 },
      { filename: "src/db/queries.test.ts", additions: 100, deletions: 20 },
    ],
    summary: {
      tldr: "Replaces string concatenation with parameterized queries to prevent SQL injection attacks. Adds security tests.",
      risks: ["security"],
      labels: ["backend", "security"],
      createdAt: "2024-01-12T11:15:00Z",
    },
    slackMessageTs: "1234567890.123455",
    createdAt: "2024-01-12T10:00:00Z",
    updatedAt: "2024-01-12T12:00:00Z",
  },
  {
    _id: "5",
    repoId: "12345",
    repoFullName: "acme/repopulse",
    number: 38,
    title: "Refactor dashboard components",
    author: "diana",
    branchFrom: "refactor/dashboard",
    branchTo: "main",
    status: "merged",
    filesChanged: [
      { filename: "src/components/Dashboard.tsx", additions: 200, deletions: 300 },
      { filename: "src/components/Card.tsx", additions: 50, deletions: 0 },
      { filename: "src/components/Chart.tsx", additions: 80, deletions: 40 },
    ],
    summary: {
      tldr: "Breaks down large Dashboard component into smaller, reusable Card and Chart components. Improves maintainability.",
      risks: [],
      labels: ["frontend"],
      createdAt: "2024-01-11T09:30:00Z",
    },
    slackMessageTs: null,
    createdAt: "2024-01-11T08:00:00Z",
    updatedAt: "2024-01-11T10:00:00Z",
  },
  {
    _id: "6",
    repoId: "12345",
    repoFullName: "acme/repopulse",
    number: 37,
    title: "Add monitoring and logging",
    author: "charlie",
    branchFrom: "feature/monitoring",
    branchTo: "main",
    status: "open",
    filesChanged: [
      { filename: "src/utils/logger.ts", additions: 120, deletions: 0 },
      { filename: "src/middleware/logging.ts", additions: 60, deletions: 0 },
      { filename: "docker-compose.yml", additions: 20, deletions: 5 },
    ],
    summary: {
      tldr: "Integrates structured logging with Winston and adds request logging middleware. Sets up Prometheus metrics endpoint.",
      risks: [],
      labels: ["backend", "infra"],
      createdAt: "2024-01-10T13:20:00Z",
    },
    slackMessageTs: null,
    createdAt: "2024-01-10T11:00:00Z",
    updatedAt: "2024-01-10T13:20:00Z",
  },
];

export interface GetPRsParams {
  status?: string;  // "open" | "closed" | "merged"
  label?: string;   // one of PRLabel
  q?: string;       // search string
  page?: number;
  limit?: number;
}

export async function getPRs(params: GetPRsParams = {}): Promise<PRListResponse> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 300));

  const {
    status,
    label,
    q,
    page = 1,
    limit = 10,
  } = params;

  let filtered = [...mockPRs];

  // Filter by status
  if (status && status !== "all") {
    filtered = filtered.filter(pr => pr.status === status);
  }

  // Filter by label
  if (label) {
    filtered = filtered.filter(pr => 
      pr.summary.labels.includes(label)
    );
  }

  // Filter by search query (title and author)
  if (q) {
    const query = q.toLowerCase();
    filtered = filtered.filter(pr =>
      pr.title.toLowerCase().includes(query) ||
      pr.author.toLowerCase().includes(query)
    );
  }

  // Pagination
  const total = filtered.length;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const items = filtered.slice(startIndex, endIndex);

  return {
    items,
    total,
    page,
    limit,
  };
}

export async function getPR(id: string): Promise<PRDoc> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 200));

  const pr = mockPRs.find(p => p._id === id);
  if (!pr) {
    throw new Error(`PR with id ${id} not found`);
  }
  return pr;
}

export async function regenerateSummary(id: string): Promise<{ ok: boolean }> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 1500));

  const pr = mockPRs.find(p => p._id === id);
  if (pr) {
    // Update the summary in-memory (tweak the TL;DR)
    pr.summary.tldr = `[Regenerated] ${pr.summary.tldr}`;
    pr.summary.createdAt = new Date().toISOString();
    pr.updatedAt = new Date().toISOString();
  }

  return { ok: true };
}

