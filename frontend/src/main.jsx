import React, { useState } from "react";
import { createRoot } from "react-dom/client";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function App() {
  const [supplierId, setSupplierId] = useState("");
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (!supplierId || photos.length === 0) return setStatus("Enter a supplier ID and choose photos.");
    const body = new FormData();
    body.append("supplier_id", supplierId);
    photos.forEach((file) => body.append("photos", file));
    setStatus("Uploading and analyzing…"); setResult(null);
    try {
      const response = await fetch(`${API_URL}/api/inspections`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Upload failed");
      setResult(data); setStatus("Inspection complete.");
    } catch (error) { setStatus(error.message); }
  }
  return <main>
    <h1>TrustGrid QC</h1><p>Weighbridge biomass screening</p>
    <form onSubmit={submit}>
      <label>Supplier ID <input required value={supplierId} onChange={e => setSupplierId(e.target.value)} /></label><br />
      <label>Photos (1–5, max 15 MB each) <input required type="file" accept="image/jpeg,image/png,image/webp" multiple
        onChange={e => setPhotos(Array.from(e.target.files).slice(0, 5))} /></label>
      <p>{photos.map(f => f.name).join(", ")}</p><button disabled={status === "Uploading and analyzing…"}>Analyze load</button>
    </form>
    <p aria-live="polite">{status}</p>
    {result && <section><h2>AI result</h2><p>Inspection: {result.inspection_id}</p><pre>{JSON.stringify(result.analysis, null, 2)}</pre></section>}
  </main>;
}
createRoot(document.getElementById("root")).render(<App />);
