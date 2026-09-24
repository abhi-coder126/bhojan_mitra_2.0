import AsyncButton from "../components/AsyncButton";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import API from "../api/axios";

// Parses just enough of the user-agent string to show a friendly "Chrome on Windows"
// style label -- no library needed for this level of detail.
const parseDevice = (userAgent) => {
  if (!userAgent) return "-";
  const ua = userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
};

export default function AuditLogs() {
  const [view, setView] = useState("changes");
  const [logs, setLogs] = useState([]);
  const [entity, setEntity] = useState("");

  const fetchLogs = async () => {
    try {
      const params = view === "logins" ? { entity: "Auth", limit: 200 } : entity ? { entity } : {};
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
  }, [entity, view]);

  const formatValue = (value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="customers-page">
      <div className="page-head">
        <div>
          <h1>Audit Log</h1>
          <p>Track sensitive changes and login activity across the system.</p>
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

      {view === "changes" && (
        <div className="customer-search-card">
          <select value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">All entities</option>
            <option value="RestaurantOrder">Restaurant Order</option>
            <option value="Product">Product</option>
            <option value="Sale">Sale</option>
            <option value="RawMaterial">Raw Material</option>
          </select>
          <AsyncButton onClick={fetchLogs}>Refresh</AsyncButton>
        </div>
      )}

      {view === "logins" ? (
        <div className="customers-table-card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Status</th>
                <th>IP Address</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="5">No login activity yet</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.createdAt).toLocaleString("en-IN")}</td>
                    <td>{log.actor}</td>
                    <td>
                      {log.action === "login_success" ? (
                        <span className="login-status-chip success"><ShieldCheck size={13} /> Success</span>
                      ) : (
                        <span className="login-status-chip failed"><ShieldAlert size={13} /> Failed ({log.field || "invalid"})</span>
                      )}
                    </td>
                    <td>{log.ip || "-"}</td>
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
                <th>Action</th>
                <th>Entity</th>
                <th>Field</th>
                <th>Old Value</th>
                <th>New Value</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="7">No audit entries yet</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.createdAt).toLocaleString("en-IN")}</td>
                    <td>{log.actor}</td>
                    <td>{log.action}</td>
                    <td>{log.entity} {log.entityId ? `(${String(log.entityId).slice(-6)})` : ""}</td>
                    <td>{log.field || "-"}</td>
                    <td>{formatValue(log.oldValue)}</td>
                    <td>{formatValue(log.newValue)}</td>
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
