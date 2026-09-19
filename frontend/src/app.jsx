import { useState } from "react";
import { AnalysisResult } from "./components/analysis-result.jsx";
import { InspectionForm } from "./components/inspection-form.jsx";
import { useInspection } from "./hooks/use-inspection.js";

export function App() {
  const [supplierId, setSupplierId] = useState("");
  const [photos, setPhotos] = useState([]);
  const { status, message, result, submit } = useInspection();

  function handleSubmit(event) {
    event.preventDefault();
    submit({ supplierId, photos });
  }

  return <main>
    <h1>TrustGrid QC</h1>
    <p>Weighbridge biomass screening</p>
    <InspectionForm supplierId={supplierId} photos={photos} isSubmitting={status === "submitting"}
      onSupplierIdChange={setSupplierId} onPhotosChange={setPhotos} onSubmit={handleSubmit} />
    <p aria-live="polite">{message}</p>
    <AnalysisResult result={result} />
  </main>;
}
