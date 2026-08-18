export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.PROD ? "/_/backend" : "http://localhost:8000");
