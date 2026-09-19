import { useState } from "react";
import { AnalysisResult } from "./components/inspection-result.jsx";
import { InspectionForm } from "./components/inspection-form.jsx";
import { useInspectionSubmission } from "./hooks/use-inspection-submission.js";

export function App() {
  const [supplierId, setSupplierId] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const { status, message, inspectionResult, submitInspection } = useInspectionSubmission();

  function handleSubmit(event) {
    event.preventDefault();
    submitInspection({ supplierId, photos: selectedPhotos });
  }

  return <main>
    <h1>TrustGrid QC</h1>
    <p>Weighbridge biomass screening</p>
    <InspectionForm supplierId={supplierId} photos={selectedPhotos} isSubmitting={status === "submitting"}
      onSupplierIdChange={setSupplierId} onPhotosChange={setSelectedPhotos} onSubmit={handleSubmit} />
    <p aria-live="polite">{message}</p>
    <AnalysisResult result={inspectionResult} />
  </main>;
}
