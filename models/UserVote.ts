import mongoose, { Document, Schema } from 'mongoose';

interface IUserVote extends Document {
  walletAddress: string;
  hasVoted: boolean;
}

const UserVoteSchema: Schema = new Schema({
  walletAddress: { type: String, required: true, unique: true },
  hasVoted: { type: Boolean, required: true },
});

const UserVote = mongoose.model<IUserVote>('UserVote', UserVoteSchema);

export default UserVote;
