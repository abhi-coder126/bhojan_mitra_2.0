import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://bhojan-mitra.onrender.com/api";

const API = axios.create({
  baseURL: API_BASE_URL,
  // Without this, a hung backend call (e.g. an SMTP connection that never times out
  // server-side, or a free-tier Render instance waking from sleep) leaves buttons
  // stuck on their loading state forever instead of failing with a message the user
  // can act on. 45s comfortably covers a Render cold start.
  timeout: 45000,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const branchId = localStorage.getItem("branchId");
  if (branchId) {
    config.params = { ...(config.params || {}), branchId };
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401 && window.location.pathname !== "/login") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    if (error.code === "ECONNABORTED" || error.message === "Network Error") {
      error.response = {
        data: { message: "Server is taking too long to respond. Please try again in a few seconds." },
      };
    }

    return Promise.reject(error);
  }
);

export default API;
