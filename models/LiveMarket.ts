import mongoose from 'mongoose';

const LiveMarketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  question: { type: String, required: true },
  outcomes: { type: [String], required: true },
  source: { type: String, required: true },
  endTime: { type: String, required: true },
  trading: {
    yes: { type: Number, required: true },
    no: { type: Number, required: true }
  },
  marketAddress: { type: String, required: true } 
});

const LiveMarket = mongoose.model('LiveMarket', LiveMarketSchema);
export default LiveMarket;
