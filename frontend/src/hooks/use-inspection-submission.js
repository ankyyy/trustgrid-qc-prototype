import { useState } from "react";
import { createInspection } from "../api/inspections.api.js";

export function useInspectionSubmission() {
  const [inspectionState, setInspectionState] = useState({ status: "idle", message: "", inspectionResult: null });

  async function submitInspection({ supplierId, photos }) {
    if (!supplierId || photos.length === 0) {
      setInspectionState({ status: "error", message: "Enter a supplier ID and choose photos.", inspectionResult: null });
      return;
    }
    setInspectionState({ status: "submitting", message: "Uploading and analyzing…", inspectionResult: null });
    try {
      const inspectionResult = await createInspection({ supplierId, photos });
      setInspectionState({ status: "success", message: "Inspection complete.", inspectionResult });
    } catch (error) {
      setInspectionState({ status: "error", message: error.message, inspectionResult: null });
    }
  }

  return { ...inspectionState, submitInspection };
}
