import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import { setPlatformCache, usePlatform } from "../api/platform";
import AsyncButton from "./AsyncButton";

const errorText = (error, fallback) => error.response?.data?.message || error.message || fallback;

// Settings -> Manage Branches (master admin only). The switch controls whether new
// branches can be added; existing branches keep working either way.
export function ManageBranchesPanel({ showToast }) {
  const platform = usePlatform();
  const [saving, setSaving] = useState(false);
  const enabled = Boolean(platform?.multiBranchEnabled);

  const toggle = async () => {
    setSaving(true);
    try {
      const res = await API.put("/platform", { multiBranchEnabled: !enabled });
      setPlatformCache(res.data.platform);
      showToast(
        res.data.platform.multiBranchEnabled ? "Manage Branches turned on" : "Manage Branches turned off",
        "success"
      );
    } catch (error) {
      showToast(errorText(error, "Could not update Manage Branches"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-section">
      <h2>Manage Branches</h2>

      <div className="bm-card" style={{ marginTop: 12 }}>
        <div className="bm-toggle-row">
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Multi-branch mode</h3>
            <p className="bm-muted" style={{ margin: "4px 0 0", maxWidth: 560 }}>
              {enabled
                ? "On: you can add new branches from Branch Management, each with its own login, menu, QR codes and royalty."
                : "Off: the business runs as a single outlet and the option to add branches is hidden."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Multi-branch mode"
            className="bm-switch"
            disabled={!platform || saving}
            onClick={toggle}
          />
        </div>
      </div>

      {enabled ? (
        <p className="bm-muted" style={{ marginTop: 12 }}>
          Go to <Link to="/branches">Branch Management</Link> to add branches, set royalty, and put branches on hold.
        </p>
      ) : (
        <div className="bm-notice" style={{ marginTop: 12 }}>
          Turning this off only hides adding new branches. Branches that already exist keep running and stay
          available in Branch Management.
        </div>
      )}
    </div>
  );
}

const SUPPORT_FIELDS = [
  { key: "supportName", label: "Support team name", placeholder: "BhojanMitra Support" },
  { key: "supportWhatsapp", label: "WhatsApp number", placeholder: "98XXXXXXXX", inputMode: "tel" },
  { key: "supportPhone", label: "Call number", placeholder: "+91 98XXXXXXXX", inputMode: "tel" },
  { key: "supportEmail", label: "Support email", placeholder: "support@yourcompany.com", type: "email" },
  { key: "supportHours", label: "Support hours", placeholder: "Mon-Sat, 10:00 AM - 7:00 PM" },
];

// Settings -> Support Contacts (master admin only): what every user sees on the
// Support page.
export function SupportContactsPanel({ showToast }) {
  const platform = usePlatform();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!platform || form) return;
    const s = platform.support || {};
    setForm({
      supportName: s.name || "",
      supportWhatsapp: s.whatsapp || "",
      supportPhone: s.phone || "",
      supportEmail: s.email || "",
      supportHours: s.hours || "",
    });
  }, [platform, form]);

  const save = async () => {
    try {
      const res = await API.put("/platform", form);
      setPlatformCache(res.data.platform);
      showToast("Support contacts saved", "success");
    } catch (error) {
      showToast(errorText(error, "Could not save support contacts"));
    }
  };

  return (
    <div className="settings-section">
      <h2>Support Contacts</h2>
      <p className="bm-muted">
        Shown to every user on the <Link to="/support">Support</Link> page. Leave a channel empty to hide it.
      </p>

      {!form ? (
        <p className="bm-muted">Loading...</p>
      ) : (
        <>
          <div className="bm-grid" style={{ marginTop: 14 }}>
            {SUPPORT_FIELDS.map((field) => (
              <div className="bm-field" key={field.key}>
                <label htmlFor={`support-${field.key}`}>{field.label}</label>
                <input
                  id={`support-${field.key}`}
                  type={field.type || "text"}
                  inputMode={field.inputMode}
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="bm-modal-footer" style={{ justifyContent: "flex-start" }}>
            <AsyncButton className="bm-btn bm-btn-primary" onClick={save}>
              Save support contacts
            </AsyncButton>
          </div>
        </>
      )}
    </div>
  );
}
