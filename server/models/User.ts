import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "admin" | "viewer";

export interface IUser extends Document {
  githubId: number;
  username: string;
  email: string;
  avatarUrl: string;
  installationIds: number[];
  role: UserRole;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    githubId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    installationIds: {
      type: [Number],
      default: [],
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "viewer"],
      default: "viewer",
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Ensure unique index on githubId
UserSchema.index({ githubId: 1 }, { unique: true });

// Helper function to get model (fixes Hot Reload issues in dev)
export function getUserModel(): Model<IUser> {
  if (mongoose.models.User) {
    return mongoose.models.User as Model<IUser>;
  }
  return mongoose.model<IUser>("User", UserSchema);
}

// Export model as default
const User = getUserModel();
export default User;


