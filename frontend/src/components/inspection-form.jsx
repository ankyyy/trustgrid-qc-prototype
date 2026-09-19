export function InspectionForm({ supplierId, photos, isSubmitting, onSupplierIdChange, onPhotosChange, onSubmit }) {
  return <form onSubmit={onSubmit}>
    <label>
      Supplier ID
      <input required value={supplierId} onChange={(event) => onSupplierIdChange(event.target.value)} />
    </label>
    <br />
    <label>
      Photos (1–5, max 15 MB each)
      <input required type="file" accept="image/jpeg,image/png,image/webp" multiple
        onChange={(event) => onPhotosChange(Array.from(event.target.files).slice(0, 5))} />
    </label>
    {photos.length > 0 && <p>Selected: {photos.map((photo) => photo.name).join(", ")}</p>}
    <button disabled={isSubmitting}>{isSubmitting ? "Analyzing…" : "Analyze load"}</button>
  </form>;
}
