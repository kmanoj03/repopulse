import mongoose, { Schema, Document, Model } from 'mongoose';

// Type definitions for summary status
export type SummaryStatus = 'pending' | 'ready' | 'error';

export interface PullRequestSummary {
  tldr: string;
  risks: string[];      // human readable risk bullets from LLM
  labels: string[];     // semantic tags from LLM
  createdAt: Date;
}

export interface DiffStats {
  totalAdditions: number;
  totalDeletions: number;
  changedFilesCount: number;
}

// TypeScript interface
export interface IPullRequest extends Document {
  installationId: number;
  userId: mongoose.Types.ObjectId | null;
  repoId: string;
  repoFullName: string;
  number: number;
  title: string;
  author: string;
  branchFrom: string;
  branchTo: string;
  status: 'open' | 'closed' | 'merged';
  filesChanged: Array<{
    filename: string;
    additions: number;
    deletions: number;
  }>;
  summary: PullRequestSummary | null;
  summaryStatus: SummaryStatus;
  summaryError: string | null;
  lastSummarizedAt: Date | null;
  systemLabels?: string[]; // deterministic labels
  riskFlags?: string[];    // risk flags
  riskScore?: number;      // 0–100
  diffStats?: DiffStats;
  slackMessageTs: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Embedded schema for diff stats
const DiffStatsSchema = new Schema<DiffStats>(
  {
    totalAdditions: { type: Number, default: 0 },
    totalDeletions: { type: Number, default: 0 },
    changedFilesCount: { type: Number, default: 0 },
  },
  { _id: false }
);

// Mongoose schema
const pullRequestSchema = new Schema<IPullRequest>(
  {
    installationId: {
      type: Number,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    repoId: {
      type: String,
      required: true,
    },
    repoFullName: {
      type: String,
      required: true,
    },
    number: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
    },
    branchFrom: {
      type: String,
      required: true,
    },
    branchTo: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['open', 'closed', 'merged'],
    },
    filesChanged: [
      {
        filename: {
          type: String,
          required: true,
        },
        additions: {
          type: Number,
          required: true,
        },
        deletions: {
          type: Number,
          required: true,
        },
      },
    ],
    summary: {
      type: {
        tldr: { type: String },
        risks: { type: [String], default: [] },
        labels: { type: [String], default: [] },
        createdAt: { type: Date },
      },
      default: null,
    },
    summaryStatus: {
      type: String,
      enum: ['pending', 'ready', 'error'],
      default: 'pending',
    },
    summaryError: {
      type: String,
      default: null,
    },
    lastSummarizedAt: {
      type: Date,
      default: null,
    },
    systemLabels: {
      type: [String],
      default: [],
    },
    riskFlags: {
      type: [String],
      default: [],
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    diffStats: {
      type: DiffStatsSchema,
      default: () => ({
        totalAdditions: 0,
        totalDeletions: 0,
        changedFilesCount: 0,
      }),
    },
    slackMessageTs: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Add compound indexes
pullRequestSchema.index({ installationId: 1, status: 1 });
pullRequestSchema.index({ repoId: 1, number: 1 }, { unique: true });

// Create model
const PullRequest: Model<IPullRequest> = mongoose.model<IPullRequest>(
  'PullRequest',
  pullRequestSchema
);

// Helper function to get model (fixes Hot Reload issues in dev)
export function getPullRequestModel(): Model<IPullRequest> {
  if (mongoose.models.PullRequest) {
    return mongoose.models.PullRequest as Model<IPullRequest>;
  }
  return PullRequest;
}

// Export model as default
export default PullRequest;

