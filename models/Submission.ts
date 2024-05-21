import { Schema, model, Document } from 'mongoose';

interface ISubmission extends Document {
  title: string;
  question: string;
  outcomes: string[];
  source: string;
  endTime: string;
  votes: number;
}

const submissionSchema = new Schema<ISubmission>({
  title: { type: String, required: true },
  question: { type: String, required: true },
  outcomes: { type: [String], required: true },
  source: { type: String, required: true },
  endTime: { type: String, required: true },
  votes: { type: Number, default: 0 },
});

const Submission = model<ISubmission>('Submission', submissionSchema);

export default Submission;
