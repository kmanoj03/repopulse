import mongoose, { Schema, Document, Model } from 'mongoose';

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
  summary: {
    tldr: string;
    risks: string[];
    labels: string[];
    createdAt: Date;
  };
  slackMessageTs: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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
      tldr: {
        type: String,
        required: true,
      },
      risks: {
        type: [String],
        required: true,
      },
      labels: {
        type: [String],
        required: true,
      },
      createdAt: {
        type: Date,
        required: true,
      },
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

