import mongoose, { Document, Schema } from 'mongoose';

interface ILiveMarket extends Document {
  title: string;
  question: string;
  outcomes: string[];
  source: string;
  endTime: string;
  votes: number;
  trading: {
    yes: number;
    no: number;
  };
  marketAddress: string;
  questionId: string;
  isResolved: boolean;
  isRedeemed: boolean;
}

const LiveMarketSchema: Schema = new Schema({
  title: { type: String, required: true },
  question: { type: String, required: true },
  outcomes: [{ type: String, required: true }],
  source: { type: String, required: true },
  endTime: { type: String, required: true },
  votes: { type: Number, required: true },
  trading: {
    yes: { type: Number, required: true },
    no: { type: Number, required: true }
  },
  marketAddress: { type: String, required: true },
  questionId: { type: String, required: true },
  isResolved: { type: Boolean, default: false },
  isRedeemed: { type: Boolean, default: false }
});

const LiveMarket = mongoose.model<ILiveMarket>('LiveMarket', LiveMarketSchema);

export default LiveMarket;


// import mongoose from 'mongoose';

// const LiveMarketSchema = new mongoose.Schema({
//   title: { type: String, required: true },
//   question: { type: String, required: true },
//   outcomes: { type: [String], required: true },
//   source: { type: String, required: true },
//   endTime: { type: String, required: true },
//   trading: {
//     yes: { type: Number, required: true },
//     no: { type: Number, required: true }
//   },
//   marketAddress: { type: String, required: true },
//   questionId: { type: String, required: true } 
// });

// const LiveMarket = mongoose.model('LiveMarket', LiveMarketSchema);
// export default LiveMarket;
