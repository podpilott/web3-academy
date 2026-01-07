import axios from "axios";
import { config } from "./config";

/**
 * Axios instance configured for the backend API.
 * Automatically adds the auth token from localStorage.
 */
const api = axios.create({
  baseURL: config.api.baseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((requestConfig) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

export default api;
