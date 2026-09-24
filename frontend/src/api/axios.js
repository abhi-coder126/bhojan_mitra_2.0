import axios from "axios";
import { clearSession, getActiveBranch, isMasterAdmin, setActiveBranch } from "./session";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://bhojan-mitra.onrender.com/api";

const API = axios.create({
  baseURL: API_BASE_URL,
  // Without this, a hung backend call (e.g. an SMTP connection that never times out
  // server-side, or a free-tier Render instance waking from sleep) leaves buttons
  // stuck on their loading state forever instead of failing with a message the user
  // can act on. 45s comfortably covers a Render cold start.
  timeout: 45000,
});

// Customer QR menu URLs: /menu/<branchCode>/<table>, or the legacy /menu/<table>
// (printed before multi-branch; the server maps it to the main branch).
const menuBranchCode = () => {
  const match = window.location.pathname.match(/^\/menu\/([^/]+)\/[^/]+\/?$/);
  return match ? decodeURIComponent(match[1]).toUpperCase() : "";
};

const isCustomerMenuPage = () => window.location.pathname.startsWith("/menu/");

// Head-office endpoints that must not run inside whichever branch is open.
const isHeadOfficeRequest = (url = "") => /^\/?(branches|platform)(\/|$|\?)/.test(url);

API.interceptors.request.use((config) => {
  config.headers = config.headers || {};

  if (isCustomerMenuPage()) {
    // Never leak a staff session into the customer menu: an order placed here must
    // go to the branch in the QR code, not the branch of whoever is logged in.
    const code = menuBranchCode();
    if (code) config.headers["x-branch-code"] = code;
    return config;
  }

  const token = localStorage.getItem("token");
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;

  if (isMasterAdmin() && !isHeadOfficeRequest(config.url)) {
    const branch = getActiveBranch();
    if (branch?.id) config.headers["x-branch-id"] = branch.id;
  }

  return config;
});

const goToLogin = (reason) => {
  clearSession();
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  window.location.href = `/login${query}`;
};

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const onStaffPage = window.location.pathname !== "/login" && !isCustomerMenuPage();

    if (onStaffPage && status === 401) {
      goToLogin();
    } else if (onStaffPage && status === 403 && code === "BRANCH_INACTIVE") {
      // The branch was put on hold / removed while this user was logged in.
      goToLogin(error.response.data.message);
    } else if (onStaffPage && code === "BRANCH_NOT_FOUND" && isMasterAdmin()) {
      setActiveBranch(null);
      window.location.href = "/branches";
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
