import multer from "multer";
export function notFoundHandler(_request, response) { response.status(404).json({ detail: "Route not found." }); }
export function errorHandler(error, _request, response, _next) {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return response.status(413).json({ detail: "Each image must be 15 MB or smaller." });
  if (error instanceof multer.MulterError) return response.status(400).json({ detail: error.message });
  if (error.status) return response.status(error.status).json({ detail: error.message });
  console.error("Unhandled request error:", error);
  return response.status(500).json({ detail: "Unexpected server error." });
}
