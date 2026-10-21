const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    upiId: { type: String, required: true, trim: true, lowercase: true },
    payeeName: { type: String, trim: true, default: "" },
    amount: { type: Number, min: 0.01, default: null }, // null = payer enters the amount
    note: { type: String, trim: true, default: "" },
    upiLink: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
