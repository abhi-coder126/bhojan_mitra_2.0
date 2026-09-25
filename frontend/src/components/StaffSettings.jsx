import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import API from "../api/axios";
import AsyncButton from "../components/AsyncButton";
import AsyncForm from "../components/AsyncForm";
import ConfirmActionModal from "../components/ConfirmActionModal";
import { SkeletonTable } from "../components/Skeleton";

const ROLE_LABELS = {
  captain: "Captain",
  waiter: "Waiter",
  cashier: "Cashier",
  kitchen: "Kitchen",
  inventory: "Inventory",
  staff: "Staff",
};

const emptyForm = { name: "", email: "", role: "captain", password: "" };

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// Captains and waiters are created here, by whoever runs the outlet. They sign in
// on the same login page as everyone else -- their role decides what they see.
export default function StaffSettings({ showToast }) {
  const [staff, setStaff] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    const [staffRes, perfRes] = await Promise.all([
      API.get("/staff"),
      API.get("/staff/performance"),
    ]);
    setStaff(staffRes.data.staff || []);
    setPerformance(perfRes.data.performance || []);
  }, []);

  useEffect(() => {
    load()
      .catch((error) => showToast(error.response?.data?.message || "Could not load staff", "error"))
      .finally(() => setLoading(false));
  }, [load, showToast]);

  // Performance rows arrive keyed by staff id; pair them with the roster so a
  // captain who has taken no orders yet still shows up with zeroes.
  const rows = useMemo(() => {
    const byId = new Map(performance.map((row) => [String(row.staffId), row]));
    return staff.map((member) => ({
      ...member,
      stats: byId.get(String(member._id)) || { orders: 0, cancelled: 0, revenue: 0, averageBill: 0, customers: 0 },
    }));
  }, [staff, performance]);

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (editingId) {
      await API.put(`/staff/${editingId}`, form);
      showToast("Staff member updated", "success");
    } else {
      await API.post("/staff", form);
      showToast("Staff member added", "success");
    }
    reset();
    await load();
  };

  const edit = (member) => {
    setEditingId(member._id);
    // Password is never sent back by the API; blank means "keep the current one".
    setForm({ name: member.name, email: member.email, role: member.role, password: "" });
  };

  const toggleActive = async (member) => {
    await API.patch(`/staff/${member._id}/active`, { isActive: !member.isActive });
    showToast(member.isActive ? "Login disabled" : "Login enabled", "success");
    await load();
  };

  return (
    <div className="settings-section">
      <h2>Captains, Waiters &amp; Staff</h2>
      <p className="settings-section-note">
        Create a login for each captain or waiter. They sign in on the same page you do, take orders,
        and every order they punch is credited to them below.
      </p>

      <AsyncForm className="settings-form-grid staff-form" onSubmit={submit}>
        <input
          placeholder="Full name"
          value={form.name}
          onChange={(e) => change("name", e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Login email"
          value={form.email}
          onChange={(e) => change("email", e.target.value)}
          required
        />
        <select value={form.role} onChange={(e) => change("role", e.target.value)}>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          type="password"
          placeholder={editingId ? "New password (leave blank to keep)" : "Password (min 6 characters)"}
          value={form.password}
          onChange={(e) => change("password", e.target.value)}
          autoComplete="new-password"
          required={!editingId}
        />
        <div className="staff-form-actions">
          <button type="submit">
            <Plus size={15} /> {editingId ? "Save changes" : "Add staff member"}
          </button>
          {editingId && (
            <button type="button" className="bm-btn" onClick={reset}>
              Cancel edit
            </button>
          )}
        </div>
      </AsyncForm>

      <h3 className="staff-table-title">Team &amp; performance</h3>
      {loading ? (
        <SkeletonTable rows={4} columns={7} />
      ) : rows.length === 0 ? (
        <p className="bm-empty">No captains or waiters yet. Add the first one above.</p>
      ) : (
        <div className="bm-table-wrap">
          <table className="bm-table staff-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th className="num">Orders</th>
                <th className="num">Business brought</th>
                <th className="num">Avg bill</th>
                <th className="num">Customers</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => (
                <tr key={member._id} className={member.isActive ? "" : "staff-row-inactive"}>
                  <td>
                    <span className="bm-branch-name">{member.name}</span>
                    <small className="staff-email">{member.email}</small>
                  </td>
                  <td>
                    <span className="bm-status bm-status-hold">{ROLE_LABELS[member.role] || member.role}</span>
                    {!member.isActive && <span className="bm-status bm-status-archived">login off</span>}
                  </td>
                  <td className="num">
                    <b>{member.stats.orders}</b>
                    {member.stats.cancelled > 0 && (
                      <small className="staff-cancelled">{member.stats.cancelled} cancelled</small>
                    )}
                  </td>
                  <td className="num"><b>{money(member.stats.revenue)}</b></td>
                  <td className="num">{money(member.stats.averageBill)}</td>
                  <td className="num">{member.stats.customers}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="bm-btn bm-btn-sm" onClick={() => edit(member)} title="Edit">
                        <Pencil size={14} /> Edit
                      </button>
                      <AsyncButton className="bm-btn bm-btn-sm" onClick={() => toggleActive(member)}>
                        {member.isActive ? <><UserRound size={14} /> Disable</> : <><BadgeCheck size={14} /> Enable</>}
                      </AsyncButton>
                      <button
                        type="button"
                        className="bm-btn bm-btn-sm"
                        title="Remove"
                        onClick={() =>
                          setConfirm({
                            name: member.name,
                            run: async () => {
                              await API.delete(`/staff/${member._id}`);
                              showToast("Staff member removed", "success");
                              await load();
                            },
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmActionModal
        open={Boolean(confirm)}
        title={`Remove ${confirm?.name || "this staff member"}?`}
        message="Their login stops working immediately. Orders they already took keep their name. To keep the login but block it instead, use Disable."
        confirmText="Remove"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            await confirm.run();
          } catch (error) {
            showToast(error.response?.data?.message || "Could not remove", "error");
          } finally {
            setConfirm(null);
          }
        }}
      />
    </div>
  );
}
