import { useState } from "react";
import { createInspection } from "../api/inspection-api.js";

export function useInspection() {
  const [state, setState] = useState({ status: "idle", message: "", result: null });

  async function submit({ supplierId, photos }) {
    if (!supplierId || photos.length === 0) {
      setState({ status: "error", message: "Enter a supplier ID and choose photos.", result: null });
      return;
    }
    setState({ status: "submitting", message: "Uploading and analyzing…", result: null });
    try {
      const result = await createInspection({ supplierId, photos });
      setState({ status: "success", message: "Inspection complete.", result });
    } catch (error) {
      setState({ status: "error", message: error.message, result: null });
    }
  }

  return { ...state, submit };
}
