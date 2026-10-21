import { useEffect, useState } from "react";

const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const inr = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

export default function App() {
  const [form, setForm] = useState({ upiId: "", amount: "", payeeName: "", note: "" });
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/qr/history");
      if (res.ok) setHistory(await res.json());
    } catch {
      /* history is optional */
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const generate = async (e) => {
    e.preventDefault();
    setError("");

    if (!UPI_ID_REGEX.test(form.upiId.trim())) {
      return setError("Enter a valid UPI ID, like name@bank.");
    }
    if (form.amount !== "" && !(Number(form.amount) > 0)) {
      return setError("Enter an amount greater than 0, or leave it blank.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't generate the QR code.");
      setResult(data);
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = result.qr;
    a.download = `upi-${result.upiId.replace("@", "-")}${result.amount ? `-${result.amount}` : ""}.png`;
    a.click();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(result.upiLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openHistory = async (id) => {
    const res = await fetch(`/api/qr/${id}`);
    if (res.ok) {
      setResult(await res.json());
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const removeHistory = async (id) => {
    await fetch(`/api/qr/${id}`, { method: "DELETE" });
    if (result?.id === id) setResult(null);
    loadHistory();
  };

  return (
    <main className="page">
      <header className="head">
        <h1>UPI QR generator</h1>
        <p>Enter a UPI ID and an amount. Scan the code with any UPI app to pay.</p>
      </header>

      <section className="grid">
        <form className="panel" onSubmit={generate} noValidate>
          <label>
            UPI ID
            <input
              value={form.upiId}
              onChange={set("upiId")}
              placeholder="name@bank"
              autoComplete="off"
              inputMode="email"
            />
          </label>

          <label>
            Amount (₹) <span className="opt">optional</span>
            <input
              value={form.amount}
              onChange={set("amount")}
              placeholder="Leave blank to let the payer choose"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
            />
          </label>

          <label>
            Payee name <span className="opt">optional</span>
            <input value={form.payeeName} onChange={set("payeeName")} maxLength={50} />
          </label>

          <label>
            Note <span className="opt">optional</span>
            <input value={form.note} onChange={set("note")} maxLength={50} placeholder="Rent, dinner, order #12" />
          </label>

          {error && <p className="error" role="alert">{error}</p>}

          <button className="primary" disabled={loading}>
            {loading ? "Generating…" : "Generate QR code"}
          </button>
        </form>

        <div className="panel result">
          {result ? (
            <>
              <div className="qr-frame">
                <img src={result.qr} alt={result.amount ? `UPI QR code to pay ${inr(result.amount)} to ${result.upiId}` : `UPI QR code to pay ${result.upiId}, payer enters the amount`} />
              </div>
              <p className="amount">{result.amount ? inr(result.amount) : "Any amount"}</p>
              <p className="to">to {result.payeeName || result.upiId}</p>
              {result.payeeName && <p className="vpa">{result.upiId}</p>}
              {!result.amount && <p className="note">The payer enters the amount in their UPI app.</p>}
              {result.note && <p className="note">“{result.note}”</p>}
              <div className="actions">
                <button onClick={download}>Download PNG</button>
                <button onClick={copyLink}>{copied ? "Copied" : "Copy UPI link"}</button>
              </div>
            </>
          ) : (
            <p className="empty">Your QR code will appear here.</p>
          )}
        </div>
      </section>

      {history.length > 0 && (
        <section className="history">
          <h2>Recent codes</h2>
          <ul>
            {history.map((h) => (
              <li key={h._id}>
                <button className="row" onClick={() => openHistory(h._id)}>
                  <span className="row-amt">{h.amount ? inr(h.amount) : "Any amount"}</span>
                  <span className="row-vpa">{h.upiId}</span>
                  <span className="row-date">
                    {new Date(h.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </button>
                <button className="del" onClick={() => removeHistory(h._id)} aria-label={`Delete code for ${h.upiId}`}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
