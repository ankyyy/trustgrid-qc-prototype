const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function createInspection({ supplierId, photos }) {
  const body = new FormData();
  body.append("supplier_id", supplierId);
  photos.forEach((photo) => body.append("photos", photo));

  const response = await fetch(`${API_URL}/api/inspections`, { method: "POST", body });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "Upload failed");
  return data;
}
