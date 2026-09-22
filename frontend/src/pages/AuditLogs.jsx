import { useEffect, useState } from "react";
import API from "../api/axios";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [entity, setEntity] = useState("");

  const fetchLogs = async () => {
    try {
      const res = await API.get("/audit-logs", { params: entity ? { entity } : {} });
      setLogs(res.data.logs || []);
    } catch {
      setLogs([]);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

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
          <p>Track sensitive changes: discounts, price overrides, refunds/cancellations and stock adjustments.</p>
        </div>
      </div>

      <div className="customer-search-card">
        <select value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">All entities</option>
          <option value="RestaurantOrder">Restaurant Order</option>
          <option value="Product">Product</option>
          <option value="Sale">Sale</option>
          <option value="RawMaterial">Raw Material</option>
        </select>
        <button onClick={fetchLogs}>Refresh</button>
      </div>

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
    </div>
  );
}
