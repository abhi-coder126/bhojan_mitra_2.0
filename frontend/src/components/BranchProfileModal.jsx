import { useEffect, useState } from "react";
import { Clock, Store, X } from "lucide-react";
import API from "../api/axios";
import AsyncButton from "./AsyncButton";
import { SkeletonLine } from "./Skeleton";

const FIELDS = [
  { key: "name", label: "Branch name", required: true },
  { key: "phone", label: "Phone", inputMode: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "city", label: "City" },
  { key: "gstNumber", label: "GST number", uppercase: true },
  { key: "address", label: "Address", full: true },
];

const FIELD_LABEL = Object.fromEntries(FIELDS.map((field) => [field.key, field.label]));

// A branch admin's own outlet details. Edits are not saved straight away: they are
// sent to head office as a change request and applied once the master admin approves.
export default function BranchProfileModal({ onClose, onSubmitted, showToast }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await API.get("/branches/profile");
      setData(res.data);
      setForm(
        Object.fromEntries(FIELDS.map((field) => [field.key, res.data.branch?.[field.key] || ""]))
      );
    } catch (cause) {
      setError(cause.response?.data?.message || "Could not load the branch profile");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setError("");
    try {
      const res = await API.post("/branches/profile/request", form);
      showToast?.("Sent to head office for approval", "success");
      onSubmitted?.(res.data.request);
      onClose();
    } catch (cause) {
      setError(cause.response?.data?.message || "Could not send the request");
    }
  };

  const pending = data?.pending;
  const lastReviewed = data?.history?.find((row) => row.status !== "pending");

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal-card bm-profile-modal" role="dialog" aria-modal="true" aria-label="Branch profile">
        <div className="modal-head">
          <h2>
            <Store size={18} /> Branch profile
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!data && !error && (
          <div className="bm-profile-grid">
            {FIELDS.map((field) => (
              <div className="bm-profile-field" key={field.key}>
                <SkeletonLine width="40%" height={11} />
                <SkeletonLine height={38} radius={10} />
              </div>
            ))}
          </div>
        )}

        {data && (
          <>
            <p className="bm-profile-note">
              Head office approves branch detail changes. Your branch code ({data.branch.code}) cannot be changed,
              because printed QR codes use it.
            </p>

            {pending && (
              <div className="bm-profile-pending">
                <Clock size={15} />
                <div>
                  <b>A change request is already waiting for approval.</b>
                  <span>
                    {Object.entries(pending.changes)
                      .map(([key, value]) => `${FIELD_LABEL[key] || key}: ${value}`)
                      .join(" · ")}
                  </span>
                </div>
              </div>
            )}

            {!pending && lastReviewed && (
              <div className={`bm-profile-reviewed is-${lastReviewed.status}`}>
                Your last request was {lastReviewed.status} by {lastReviewed.reviewedBy || "head office"}
                {lastReviewed.reviewNote ? `: ${lastReviewed.reviewNote}` : "."}
              </div>
            )}

            <div className="bm-profile-grid">
              {FIELDS.map((field) => (
                <div className={`bm-profile-field${field.full ? " is-full" : ""}`} key={field.key}>
                  <label htmlFor={`branch-${field.key}`}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>
                  <input
                    id={`branch-${field.key}`}
                    type={field.type || "text"}
                    inputMode={field.inputMode}
                    disabled={Boolean(pending)}
                    value={form?.[field.key] ?? ""}
                    onChange={(e) => set(field.key, field.uppercase ? e.target.value.toUpperCase() : e.target.value)}
                  />
                </div>
              ))}
            </div>

            {error && (
              <div className="bm-error" role="alert">
                {error}
              </div>
            )}

            <div className="bm-profile-actions">
              <button type="button" className="bm-btn" onClick={onClose}>
                Close
              </button>
              <AsyncButton className="bm-btn bm-btn-primary" disabled={Boolean(pending)} onClick={submit}>
                Send for approval
              </AsyncButton>
            </div>
          </>
        )}

        {error && !data && (
          <div className="bm-error" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
