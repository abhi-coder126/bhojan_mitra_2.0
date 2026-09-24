// Logged-in staff user + the branch the UI is currently working in.
//
// Branch staff are always in their own branch (the server enforces it; this is just
// for display). The master admin picks a branch to open; that choice is kept in
// localStorage and sent to the server as the `x-branch-id` header (see axios.js).
const ACTIVE_BRANCH_KEY = "activeBranch";
export const BRANCH_CHANGED_EVENT = "bhojan:branch-changed";

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

export const getUser = () => readJson("user") || {};
export const isMasterAdmin = () => getUser().role === "master_admin";

// { id, name, code } or null.
export const getActiveBranch = () => {
  const user = getUser();
  if (user.role && user.role !== "master_admin") return user.branch || null;
  return readJson(ACTIVE_BRANCH_KEY);
};

export const setActiveBranch = (branch) => {
  if (branch) {
    localStorage.setItem(
      ACTIVE_BRANCH_KEY,
      JSON.stringify({ id: branch.id || branch._id, name: branch.name, code: branch.code })
    );
  } else {
    localStorage.removeItem(ACTIVE_BRANCH_KEY);
  }
  window.dispatchEvent(new Event(BRANCH_CHANGED_EVENT));
};

export const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem(ACTIVE_BRANCH_KEY);
  // Left over from the old, unenforced branch dropdown.
  localStorage.removeItem("branchId");
};
