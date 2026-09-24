import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  KeyRound,
  LayoutDashboard,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import API from "../api/axios";
import { usePlatform } from "../api/platform";
import { getActiveBranch, setActiveBranch } from "../api/session";
import AsyncButton from "../components/AsyncButton";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

const ROYALTY_BASES = {
  net_ex_gst: "Net sales (excl. GST)",
  gross_inc_gst: "Gross sales (incl. GST)",
  net_inc_gst: "Net sales (incl. GST)",
};

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "year", label: "This FY" },
  { key: "custom", label: "Custom" },
];

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyForm = {
  name: "",
  code: "",
  city: "",
  address: "",
  phone: "",
  email: "",
  gstNumber: "",
  royaltyPercent: "",
  royaltyBase: "net_ex_gst",
  admin: { name: "", email: "", password: "" },
};

const errorText = (error, fallback) => error.response?.data?.message || error.message || fallback;

function StatusBadge({ status }) {
  const label = status === "archived" ? "removed" : status === "hold" ? "on hold" : "active";
  return <span className={`bm-status bm-status-${status}`}>{label}</span>;
}

function Field({ label, hint, full, children }) {
  return (
    <div className={`bm-field${full ? " bm-field-full" : ""}`}>
      <label>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="bm-overlay" role="presentation">
      <div className="bm-modal" role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="bm-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {subtitle && <p className="bm-muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

// Create or edit a branch. The code is fixed after creation (printed QRs use it) and
// the admin login is managed separately when editing.
function BranchFormModal({ branch, onClose, onSaved }) {
  const isEdit = Boolean(branch);
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          ...emptyForm,
          ...Object.fromEntries(Object.keys(emptyForm).filter((k) => k !== "admin").map((k) => [k, branch[k] ?? ""])),
        }
      : emptyForm
  );
  const [error, setError] = useState("");

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setAdmin = (key, value) => setForm((current) => ({ ...current, admin: { ...current.admin, [key]: value } }));

  const percent = Number(form.royaltyPercent || 0);
  const example = (100000 * percent) / 100;

  const save = async () => {
    setError("");
    const payload = {
      name: form.name,
      city: form.city,
      address: form.address,
      phone: form.phone,
      email: form.email,
      gstNumber: form.gstNumber,
      royaltyPercent: percent,
      royaltyBase: form.royaltyBase,
    };

    try {
      if (isEdit) {
        await API.put(`/branches/${branch._id}`, payload);
      } else {
        await API.post("/branches", { ...payload, code: form.code, admin: form.admin });
      }
      onSaved(isEdit ? "Branch updated" : "Branch created. Share the admin login with the branch.");
    } catch (cause) {
      setError(errorText(cause, "Could not save branch"));
    }
  };

  return (
    <Modal
      title={isEdit ? `Edit ${branch.name}` : "Add a new branch"}
      subtitle={isEdit ? "Branch code can't be changed because printed QR codes use it." : "The branch starts with an empty menu."}
      onClose={onClose}
    >
      <div className="bm-form-section">
        <h3>Branch details</h3>
        <div className="bm-grid">
          <Field label="Branch name *">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="RestroSethu Sector 17" />
          </Field>
          <Field label="Branch code *" hint="2-10 letters/numbers. Appears in QR links, e.g. /menu/CHD17/5">
            <input
              value={form.code}
              disabled={isEdit}
              maxLength={10}
              onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="CHD17"
            />
          </Field>
          <Field label="City">
            <input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
          </Field>
          <Field label="Address" full>
            <input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Branch email">
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="GST number">
            <input value={form.gstNumber} onChange={(e) => set("gstNumber", e.target.value.toUpperCase())} />
          </Field>
        </div>
      </div>

      <div className="bm-form-section">
        <h3>Royalty</h3>
        <div className="bm-grid">
          <Field label="Royalty % *">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.royaltyPercent}
              onChange={(e) => set("royaltyPercent", e.target.value)}
              placeholder="e.g. 8"
            />
          </Field>
          <Field label="Charged on *">
            <select value={form.royaltyBase} onChange={(e) => set("royaltyBase", e.target.value)}>
              {Object.entries(ROYALTY_BASES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="bm-royalty-preview">
          Example: on {ROYALTY_BASES[form.royaltyBase].toLowerCase()} of ₹1,00,000 the branch pays{" "}
          {money(example)}. The branch admin sees this on their dashboard.
        </div>
      </div>

      {!isEdit && (
        <div className="bm-form-section">
          <h3>Branch admin login</h3>
          <div className="bm-grid">
            <Field label="Admin name *">
              <input value={form.admin.name} onChange={(e) => setAdmin("name", e.target.value)} />
            </Field>
            <Field label="Login email *">
              <input
                type="email"
                autoComplete="off"
                value={form.admin.email}
                onChange={(e) => setAdmin("email", e.target.value)}
              />
            </Field>
            <Field label="Password *" hint="At least 8 characters. The admin can change it later.">
              <input
                type="text"
                autoComplete="new-password"
                value={form.admin.password}
                onChange={(e) => setAdmin("password", e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}

      {error && <div className="bm-error" role="alert">{error}</div>}

      <div className="bm-modal-footer">
        <button type="button" className="bm-btn" onClick={onClose}>
          Cancel
        </button>
        <AsyncButton className="bm-btn bm-btn-primary" onClick={save}>
          {isEdit ? "Save changes" : "Create branch"}
        </AsyncButton>
      </div>
    </Modal>
  );
}

function AdminLoginModal({ branch, onClose, onSaved }) {
  const [form, setForm] = useState({ name: branch.admin?.name || "", email: branch.admin?.email || "", password: "" });
  const [error, setError] = useState("");
  const hasAdmin = Boolean(branch.admin);

  const save = async () => {
    setError("");
    try {
      await API.put(`/branches/${branch._id}/admin`, form);
      onSaved(form.password ? "Admin login saved with the new password" : "Admin login updated");
    } catch (cause) {
      setError(errorText(cause, "Could not save admin login"));
    }
  };

  return (
    <Modal
      title={`${hasAdmin ? "Admin login" : "Create admin login"} - ${branch.name}`}
      subtitle={hasAdmin ? "Leave the password empty to keep the current one." : "This person will manage the branch."}
      onClose={onClose}
    >
      <div className="bm-form-section bm-grid">
        <Field label="Admin name *">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Login email *">
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label={hasAdmin ? "New password" : "Password *"} hint="At least 8 characters">
          <input
            type="text"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
      </div>
      {error && <div className="bm-error" role="alert">{error}</div>}
      <div className="bm-modal-footer">
        <button type="button" className="bm-btn" onClick={onClose}>
          Cancel
        </button>
        <AsyncButton className="bm-btn bm-btn-primary" onClick={save}>
          Save login
        </AsyncButton>
      </div>
    </Modal>
  );
}

function HoldModal({ branch, onClose, onSaved }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const hold = async () => {
    setError("");
    try {
      await API.patch(`/branches/${branch._id}/status`, { status: "hold", reason });
      onSaved(`${branch.name} is on hold`);
    } catch (cause) {
      setError(errorText(cause, "Could not put branch on hold"));
    }
  };

  return (
    <Modal title={`Put ${branch.name} on hold?`} onClose={onClose}>
      <div className="bm-notice" style={{ marginTop: 12 }}>
        Branch staff are signed out and can't log in, and customers scanning this branch's QR codes see
        "temporarily not accepting orders". All data stays safe and you can resume any time.
      </div>
      <div className="bm-form-section">
        <Field label="Reason (optional, for your records)" full>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      {error && <div className="bm-error" role="alert">{error}</div>}
      <div className="bm-modal-footer">
        <button type="button" className="bm-btn" onClick={onClose}>
          Cancel
        </button>
        <AsyncButton className="bm-btn bm-btn-primary" onClick={hold}>
          Put on hold
        </AsyncButton>
      </div>
    </Modal>
  );
}

export default function BranchManagement() {
  const navigate = useNavigate();
  const platform = usePlatform();
  const [period, setPeriod] = useState("month");
  const [custom, setCustom] = useState({ startDate: "", endDate: "" });
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState(null); // { type, branch }
  const [toast, setToast] = useState("");
  // Today's sales cards at the top always show "today", independent of the period
  // tabs below (which the admin may switch to "this month" etc. for the table).
  const [todayData, setTodayData] = useState(null);

  const load = useCallback(async () => {
    if (period === "custom" && (!custom.startDate || !custom.endDate)) return;
    try {
      setLoadError("");
      const res = await API.get("/branches", {
        params: { period, includeArchived: showArchived, ...(period === "custom" ? custom : {}) },
      });
      setData(res.data);
    } catch (error) {
      setLoadError(errorText(error, "Could not load branches"));
    }
  }, [period, custom, showArchived]);

  const loadToday = useCallback(async () => {
    try {
      const res = await API.get("/branches", { params: { period: "today", includeArchived: showArchived } });
      setTodayData(res.data);
    } catch {
      // The period-tab table above already surfaces a load error; the cards can stay empty.
    }
  }, [showArchived]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const saved = (message) => {
    setModal(null);
    setToast(message);
    load();
    loadToday();
  };

  const openBranch = (branch) => {
    setActiveBranch(branch);
    navigate("/");
  };

  const resume = async (branch) => {
    await API.patch(`/branches/${branch._id}/status`, { status: "active" });
    setToast(branch.status === "archived" ? `${branch.name} restored` : `${branch.name} is active again`);
    load();
    loadToday();
  };

  const archive = async (password) => {
    const branch = modal.branch;
    await API.delete(`/branches/${branch._id}`, { data: { password } });
    if (getActiveBranch()?.id === branch._id) setActiveBranch(null);
    saved(`${branch.name} removed. Its history is kept.`);
  };

  const filterByTerm = useCallback(
    (branches) => {
      const term = search.trim().toLowerCase();
      if (!term) return branches;
      return branches.filter((b) =>
        [b.name, b.code, b.city, b.admin?.email].some((value) => String(value || "").toLowerCase().includes(term))
      );
    },
    [search]
  );

  const rows = useMemo(() => filterByTerm(data?.branches || []), [data, filterByTerm]);
  const todayRows = useMemo(() => filterByTerm(todayData?.branches || []), [todayData, filterByTerm]);

  const totals = data?.totals;
  const canAdd = Boolean(platform?.multiBranchEnabled);

  return (
    <div className="bm-page">
      <div className="bm-head">
        <div>
          <h1>Branch Management</h1>
          <p>Every branch's sales and royalty in one place. Open a branch to see and manage its data.</p>
        </div>
        {canAdd && (
          <button type="button" className="bm-btn bm-btn-primary" onClick={() => setModal({ type: "form" })}>
            <Plus size={16} /> Add branch
          </button>
        )}
      </div>

      {platform && !canAdd && (
        <div className="bm-notice">
          <Building2 size={18} />
          <span>
            Adding branches is turned off. Turn on <b>Manage Branches</b> in{" "}
            <Link to="/settings">Settings</Link> to add new branches.
          </span>
        </div>
      )}

      {toast && (
        <div className="bm-notice" role="status" style={{ borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" }}>
          {toast}
        </div>
      )}

      {todayRows.length > 0 && (
        <div>
          <h2 className="bm-section-title">Today's sales by branch</h2>
          <div className="bm-branch-cards">
            {todayRows.map((b) => {
              const openable = b.status !== "archived";
              return (
                <button
                  key={b._id}
                  type="button"
                  className={`bm-branch-card${openable ? "" : " is-disabled"}`}
                  onClick={() => openable && openBranch(b)}
                  disabled={!openable}
                  title={openable ? `Open ${b.name}'s dashboard` : `${b.name} is removed`}
                >
                  <div className="bm-branch-card-head">
                    <span className="bm-branch-card-name">{b.name}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <span className="bm-branch-card-code">
                    {b.code}
                    {b.city ? ` · ${b.city}` : ""}
                  </span>
                  <div className="bm-branch-card-sales">
                    <span>Today's sales</span>
                    <strong>{money(b.sales.grossIncGst)}</strong>
                    <small>{b.sales.bills} bills</small>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="bm-card bm-toolbar">
        <div className="bm-segmented" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              className={period === p.key ? "active" : ""}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <>
            <input
              type="date"
              aria-label="From"
              value={custom.startDate}
              onChange={(e) => setCustom({ ...custom, startDate: e.target.value })}
            />
            <input
              type="date"
              aria-label="To"
              value={custom.endDate}
              onChange={(e) => setCustom({ ...custom, endDate: e.target.value })}
            />
          </>
        )}
        <input
          type="search"
          placeholder="Search branch, code, city, admin"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="bm-check">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show removed
        </label>
      </div>

      {totals && (
        <div className="bm-kpis">
          <div className="bm-kpi">
            <span>Branches</span>
            <strong>{totals.branches}</strong>
            <small>
              {totals.active} active · {totals.hold} on hold
            </small>
          </div>
          <div className="bm-kpi">
            <span>Gross sales (incl. GST)</span>
            <strong>{money(totals.grossIncGst)}</strong>
            <small>{totals.bills} bills</small>
          </div>
          <div className="bm-kpi">
            <span>Net sales (excl. GST)</span>
            <strong>{money(totals.netExGst)}</strong>
            <small>after returns</small>
          </div>
          <div className="bm-kpi bm-kpi-accent">
            <span>Royalty receivable</span>
            <strong>{money(totals.royalty)}</strong>
            <small>for the selected period</small>
          </div>
        </div>
      )}

      <div className="bm-card">
        {loadError ? (
          <div className="bm-error" role="alert">
            {loadError}
          </div>
        ) : !data ? (
          <div className="bm-empty">Loading branches...</div>
        ) : rows.length === 0 ? (
          <div className="bm-empty">No branches match.</div>
        ) : (
          <div className="bm-table-wrap">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Admin login</th>
                  <th className="num">Bills</th>
                  <th className="num">Gross sales</th>
                  <th className="num">Net (excl. GST)</th>
                  <th>Royalty terms</th>
                  <th className="num">Royalty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b._id} className={b.status === "archived" ? "is-archived" : ""}>
                    <td>
                      <span className="bm-branch-name">{b.name}</span>
                      <span className="bm-code">{b.code}</span>
                      {b.isDefault && <span className="bm-default-tag">MAIN</span>}
                      {b.city && <div className="bm-muted">{b.city}</div>}
                      {b.status !== "active" && b.statusReason && <div className="bm-muted">Reason: {b.statusReason}</div>}
                    </td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td>
                      {b.admin ? (
                        <>
                          <div>{b.admin.name}</div>
                          <div className="bm-muted">{b.admin.email}</div>
                        </>
                      ) : (
                        <span className="bm-muted">{b.isDefault ? "Managed by head office" : "No admin yet"}</span>
                      )}
                    </td>
                    <td className="num">{b.sales.bills}</td>
                    <td className="num">{money(b.sales.grossIncGst)}</td>
                    <td className="num">{money(b.sales.netExGst)}</td>
                    <td className="bm-royalty-terms">
                      <b>{b.royalty.percent}%</b> <span className="bm-muted">of {b.royalty.baseLabel.toLowerCase()}</span>
                    </td>
                    <td className="num">
                      <b>{money(b.royalty.amount)}</b>
                    </td>
                    <td>
                      <div className="bm-actions">
                        {b.status !== "archived" && (
                          <button type="button" className="bm-btn bm-btn-sm" onClick={() => openBranch(b)}>
                            <LayoutDashboard size={14} /> Open
                          </button>
                        )}
                        <button type="button" className="bm-btn bm-btn-sm" onClick={() => setModal({ type: "form", branch: b })}>
                          <Pencil size={14} /> Edit
                        </button>
                        <button type="button" className="bm-btn bm-btn-sm" onClick={() => setModal({ type: "admin", branch: b })}>
                          <KeyRound size={14} /> Login
                        </button>
                        {b.status === "active" && (
                          <button type="button" className="bm-btn bm-btn-sm" onClick={() => setModal({ type: "hold", branch: b })}>
                            <Pause size={14} /> Hold
                          </button>
                        )}
                        {b.status !== "active" && (
                          <AsyncButton className="bm-btn bm-btn-sm" onClick={() => resume(b)}>
                            {b.status === "archived" ? <RotateCcw size={14} /> : <Play size={14} />}{" "}
                            {b.status === "archived" ? "Restore" : "Resume"}
                          </AsyncButton>
                        )}
                        {b.status !== "archived" && !b.isDefault && (
                          <button
                            type="button"
                            className="bm-btn bm-btn-sm bm-btn-danger"
                            onClick={() => setModal({ type: "archive", branch: b })}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.type === "form" && (
        <BranchFormModal branch={modal.branch} onClose={() => setModal(null)} onSaved={saved} />
      )}
      {modal?.type === "admin" && <AdminLoginModal branch={modal.branch} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.type === "hold" && <HoldModal branch={modal.branch} onClose={() => setModal(null)} onSaved={saved} />}
      <DeleteConfirmModal
        open={modal?.type === "archive"}
        title={`Remove ${modal?.branch?.name || "branch"}?`}
        message="Staff logins and QR ordering stop for this branch. Its sales and royalty history is kept, and you can restore it later. Enter your password to confirm."
        confirmText="Remove branch"
        onCancel={() => setModal(null)}
        onConfirm={archive}
      />
    </div>
  );
}
