import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInstallation extends Document {
  installationId: number;
  accountType: 'User' | 'Organization';
  accountLogin: string;
  accountAvatarUrl: string;
  repositories: Array<{
    repoId: string;
    repoFullName: string;
    private: boolean;
    installedAt: Date;
  }>;
  suspendedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const installationSchema = new Schema<IInstallation>(
  {
    installationId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    accountType: {
      type: String,
      enum: ['User', 'Organization'],
      required: true,
    },
    accountLogin: {
      type: String,
      required: true,
    },
    accountAvatarUrl: {
      type: String,
      default: '',
    },
    repositories: [
      {
        repoId: { type: String, required: true },
        repoFullName: { type: String, required: true },
        private: { type: Boolean, default: false },
        installedAt: { type: Date, default: Date.now },
      },
    ],
    suspendedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Helper function to get model (fixes Hot Reload issues in dev)
export function getInstallationModel(): Model<IInstallation> {
  if (mongoose.models.Installation) {
    return mongoose.models.Installation as Model<IInstallation>;
  }
  return mongoose.model<IInstallation>('Installation', installationSchema);
}

const Installation = getInstallationModel();
export default Installation;

