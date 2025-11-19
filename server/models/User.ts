import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "admin" | "user";

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
  },
  { timestamps: true }
);

// Ensure unique index on email
UserSchema.index({ email: 1 }, { unique: true });

// Helper function to get model (fixes Hot Reload issues in dev)
export function getUserModel(): Model<UserDocument> {
  if (mongoose.models.User) {
    return mongoose.models.User as Model<UserDocument>;
  }
  return mongoose.model<UserDocument>("User", UserSchema);
}

// Export model as default
const User = getUserModel();
export default User;

