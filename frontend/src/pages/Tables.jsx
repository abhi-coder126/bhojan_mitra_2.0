import { useEffect, useState } from "react";
import API from "../api/axios";
import { ToastViewport, useToast } from "../components/Toast";

const statusColors = {
  available: "#22c55e",
  occupied: "#ef4444",
  reserved: "#f59e0b",
  cleaning: "#38bdf8",
  billing: "#a855f7",
};

const statuses = ["available", "occupied", "reserved", "cleaning", "billing"];

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [form, setForm] = useState({ number: "", floor: "Ground Floor", section: "Main", capacity: 4 });
  const [seedCount, setSeedCount] = useState(28);
  const { toast, showToast } = useToast();

  const fetchTables = async () => {
    try {
      const res = await API.get("/tables");
      setTables(res.data.tables || []);
    } catch (error) {
      showToast(error.response?.data?.message || "Could not load tables", "warning");
    }
  };

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 8000);
    return () => clearInterval(interval);
  }, []);

  const addTable = async (e) => {
    e.preventDefault();
    try {
      await API.post("/tables", form);
      setForm({ number: "", floor: form.floor, section: form.section, capacity: 4 });
      showToast("Table added", "success");
      fetchTables();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not add table", "error");
    }
  };

  const seed = async () => {
    try {
      await API.post("/tables/seed", { count: Number(seedCount) });
      showToast("Tables generated", "success");
      fetchTables();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not seed tables", "error");
    }
  };

  const changeStatus = async (table, status) => {
    try {
      await API.patch(`/tables/${table._id}/status`, { status });
      fetchTables();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not update table status", "error");
    }
  };

  const removeTable = async (table) => {
    try {
      await API.delete(`/tables/${table._id}`);
      showToast("Table removed", "success");
      fetchTables();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not delete table", "error");
    }
  };

  const grouped = tables.reduce((acc, table) => {
    const key = table.floor || "Ground Floor";
    if (!acc[key]) acc[key] = [];
    acc[key].push(table);
    return acc;
  }, {});

  return (
    <div>
      <ToastViewport toast={toast} />

      <div className="page-head">
        <div>
          <h1>Table Management</h1>
          <p>Visual floor plan for dine-in tables. Tap a table to change its status.</p>
        </div>
      </div>

      {tables.length === 0 && (
        <div className="panel form-grid">
          <input type="number" min="1" placeholder="How many tables?" value={seedCount} onChange={(e) => setSeedCount(e.target.value)} />
          <button onClick={seed}>Generate Tables</button>
        </div>
      )}

      <form className="panel form-grid" onSubmit={addTable}>
        <input placeholder="Table Number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} required />
        <input placeholder="Floor" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
        <input placeholder="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
        <input type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        <button>Add Table</button>
      </form>

      <div className="panel">
        <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
          {statuses.map((s) => (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: statusColors[s], display: "inline-block" }} />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          ))}
        </div>

        {Object.entries(grouped).map(([floor, floorTables]) => (
          <div key={floor} style={{ marginBottom: "24px" }}>
            <h3 style={{ marginBottom: "10px" }}>{floor}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "14px" }}>
              {floorTables.map((table) => (
                <div
                  key={table._id}
                  style={{
                    border: `2px solid ${statusColors[table.status]}`,
                    background: `${statusColors[table.status]}1a`,
                    borderRadius: "12px",
                    padding: "12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "18px" }}>Table {table.number}</div>
                  <div style={{ fontSize: "12px", opacity: 0.75 }}>{table.section} · {table.capacity} seats</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: statusColors[table.status], margin: "6px 0" }}>
                    {table.status.toUpperCase()}
                  </div>
                  <select
                    value={table.status}
                    onChange={(e) => changeStatus(table, e.target.value)}
                    style={{ width: "100%", marginBottom: "6px" }}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                    disabled={table.status === "occupied" || table.status === "billing"}
                    onClick={() => removeTable(table)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {tables.length === 0 && <p>No tables yet. Generate or add tables above.</p>}
      </div>
    </div>
  );
}
