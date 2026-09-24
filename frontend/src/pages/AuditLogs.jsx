import AsyncButton from "../components/AsyncButton";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import API from "../api/axios";
import { isMasterAdmin } from "../api/session";

// Parses just enough of the user-agent string to show a friendly "Chrome on Windows"
// style label -- no library needed for this level of detail.
const parseDevice = (userAgent) => {
  if (!userAgent) return "-";
  const ua = userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
};

// Entries written before IP capture existed have no IP -- say so instead of a bare dash.
const formatIp = (ip) => {
  if (!ip) return <span title="Recorded before IP tracking was added">Not recorded</span>;
  if (ip === "::1" || ip === "127.0.0.1") return `${ip} (this computer)`;
  return ip;
};

export default function AuditLogs() {
  const isMaster = isMasterAdmin();
  const [view, setView] = useState("changes");
  const [scope, setScope] = useState("branch");
  const [logs, setLogs] = useState([]);
  const [entity, setEntity] = useState("");

  const fetchLogs = async () => {
    try {
      const params = view === "logins" ? { entity: "Auth", limit: 200 } : entity ? { entity } : {};
      if (isMaster && scope === "all") params.scope = "all";
      const res = await API.get("/audit-logs", { params });
      const rows = res.data.logs || [];
      setLogs(view === "logins" ? rows : rows.filter((log) => log.entity !== "Auth"));
    } catch {
      setLogs([]);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, view, scope]);

  const formatValue = (value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const showBranch = isMaster && scope === "all";

  return (
    <div className="customers-page">
      <div className="page-head">
        <div>
          <h1>Audit Log</h1>
          <p>Track sensitive changes and login activity, with the IP address and device each one came from.</p>
        </div>
      </div>

      <div className="audit-view-tabs">
        <button type="button" className={view === "changes" ? "active" : ""} onClick={() => setView("changes")}>
          Data Changes
        </button>
        <button type="button" className={view === "logins" ? "active" : ""} onClick={() => setView("logins")}>
          Login History
        </button>
      </div>

      <div className="customer-search-card">
        {view === "changes" && (
          <select value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">All entities</option>
            <option value="RestaurantOrder">Restaurant Order</option>
            <option value="Product">Product</option>
            <option value="Sale">Sale</option>
            <option value="RawMaterial">Raw Material</option>
            <option value="Recipe">Recipe</option>
            <option value="Branch">Branch</option>
          </select>
        )}
        {isMaster && (
          <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Scope">
            <option value="branch">This branch</option>
            <option value="all">All branches + head office</option>
          </select>
        )}
        <AsyncButton onClick={fetchLogs}>Refresh</AsyncButton>
      </div>

      {view === "logins" ? (
        <div className="customers-table-card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                {showBranch && <th>Branch</th>}
                <th>Status</th>
                <th>IP Address</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={showBranch ? 6 : 5}>No login activity yet</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.createdAt).toLocaleString("en-IN")}</td>
                    <td>{log.actor}</td>
                    {showBranch && <td>{log.branchName || "-"}</td>}
                    <td>
                      {log.action === "login_success" ? (
                        <span className="login-status-chip success"><ShieldCheck size={13} /> Success</span>
                      ) : (
                        <span className="login-status-chip failed"><ShieldAlert size={13} /> Failed ({log.field || "invalid"})</span>
                      )}
                    </td>
                    <td>{formatIp(log.ip)}</td>
                    <td>{parseDevice(log.userAgent)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="customers-table-card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Actor</th>
                {showBranch && <th>Branch</th>}
                <th>Action</th>
                <th>Entity</th>
                <th>Field</th>
                <th>Old Value</th>
                <th>New Value</th>
                <th>IP Address</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={showBranch ? 10 : 9}>No audit entries yet</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.createdAt).toLocaleString("en-IN")}</td>
                    <td>{log.actor}</td>
                    {showBranch && <td>{log.branchName || "-"}</td>}
                    <td>{log.action}</td>
                    <td>{log.entity} {log.entityId ? `(${String(log.entityId).slice(-6)})` : ""}</td>
                    <td>{log.field || "-"}</td>
                    <td>{formatValue(log.oldValue)}</td>
                    <td>{formatValue(log.newValue)}</td>
                    <td>{formatIp(log.ip)}</td>
                    <td>{parseDevice(log.userAgent)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
