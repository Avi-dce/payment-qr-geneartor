const express = require("express");
const QRCode = require("qrcode");
const Transaction = require("../models/Transaction");

const router = express.Router();

// handle@bank  e.g. rahul.k@okhdfcbank, 9876543210@ybl
const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const MAX_AMOUNT = 100000; // standard UPI per-transaction limit

function buildUpiLink({ upiId, payeeName, amount, note }) {
  const params = new URLSearchParams();
  params.set("pa", upiId);
  params.set("pn", payeeName || upiId.split("@")[0]);
  if (amount != null) params.set("am", amount.toFixed(2)); // no "am" = payer types the amount
  params.set("cu", "INR");
  if (note) params.set("tn", note);
  // URLSearchParams encodes spaces as '+', UPI apps expect %20
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

// POST /api/qr  -> generate QR
router.post("/", async (req, res, next) => {
  try {
    const { upiId, amount, payeeName = "", note = "" } = req.body;

    if (!upiId || !UPI_ID_REGEX.test(upiId.trim())) {
      return res.status(400).json({ error: "Enter a valid UPI ID, like name@bank." });
    }

    // Amount is optional: leave it blank to get a QR where the payer enters the amount.
    const hasAmount = amount !== undefined && amount !== null && String(amount).trim() !== "";
    let amt = null;
    if (hasAmount) {
      amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ error: "Enter an amount greater than 0, or leave it blank." });
      }
      if (amt > MAX_AMOUNT) {
        return res.status(400).json({ error: `Amount can't be more than ₹${MAX_AMOUNT.toLocaleString("en-IN")}.` });
      }
      if (!/^\d+(\.\d{1,2})?$/.test(String(amount).trim())) {
        return res.status(400).json({ error: "Amount can have at most 2 decimal places." });
      }
    }

    const clean = {
      upiId: upiId.trim().toLowerCase(),
      payeeName: String(payeeName).trim().slice(0, 50),
      amount: amt,
      note: String(note).trim().slice(0, 50),
    };

    const upiLink = buildUpiLink(clean);
    const qrDataUrl = await QRCode.toDataURL(upiLink, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
    });

    const saved = await Transaction.create({ ...clean, upiLink });

    res.status(201).json({
      id: saved._id,
      upiLink,
      qr: qrDataUrl,
      ...clean,
      createdAt: saved.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/qr/history -> last 20 generated QRs
router.get("/history", async (req, res, next) => {
  try {
    const items = await Transaction.find().sort({ createdAt: -1 }).limit(20).lean();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/qr/:id -> regenerate QR for a past entry
router.get("/:id", async (req, res, next) => {
  try {
    const t = await Transaction.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ error: "QR not found." });
    const qr = await QRCode.toDataURL(t.upiLink, { errorCorrectionLevel: "M", margin: 2, width: 512 });
    res.json({ ...t, id: t._id, qr });
  } catch (err) {
    if (err.name === "CastError") return res.status(400).json({ error: "Invalid id." });
    next(err);
  }
});

// DELETE /api/qr/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
