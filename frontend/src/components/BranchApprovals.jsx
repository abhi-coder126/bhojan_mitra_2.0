import { useCallback, useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import API from "../api/axios";
import AsyncButton from "./AsyncButton";
import { SkeletonList } from "./Skeleton";

const FIELD_LABEL = {
  name: "Branch name",
  address: "Address",
  city: "City",
  phone: "Phone",
  email: "Email",
  gstNumber: "GST number",
};

const TABS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const when = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

export default function BranchApprovals({ onClose, onReviewed, showToast }) {
  const [tab, setTab] = useState("pending");
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setRequests(null);
    try {
      const res = await API.get("/branches/change-requests", { params: { status: tab } });
      setRequests(res.data.requests || []);
    } catch (cause) {
      setError(cause.response?.data?.message || "Could not load requests");
      setRequests([]);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (request, action) => {
    try {
      await API.patch(`/branches/change-requests/${request._id}`, { action });
      showToast?.(action === "approve" ? "Change approved and applied" : "Change request rejected", "success");
      onReviewed?.();
      load();
    } catch (cause) {
      showToast?.(cause.response?.data?.message || "Could not update the request");
    }
  };

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal-card bm-approvals-modal" role="dialog" aria-modal="true" aria-label="Branch change requests">
        <div className="modal-head">
          <h2>
            <Bell size={18} /> Branch change requests
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="bm-segmented" role="tablist" aria-label="Request status">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={tab === item.key ? "active" : ""}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {!requests && <SkeletonList rows={3} />}

        {requests && requests.length === 0 && (
          <div className="bm-empty">
            {tab === "pending" ? "No requests waiting for approval." : `No ${tab} requests yet.`}
          </div>
        )}

        {requests && requests.length > 0 && (
          <div className="bm-approval-list">
            {requests.map((request) => (
              <article className="bm-approval-card" key={request._id}>
                <header>
                  <div>
                    <b>{request.branchName}</b>
                    <span className="bm-code">{request.branchCode}</span>
                  </div>
                  <span className="bm-muted">{when(request.createdAt)}</span>
                </header>

                <p className="bm-muted bm-approval-by">
                  Requested by {request.requestedBy?.name || "branch staff"}
                  {request.requestedBy?.email ? ` (${request.requestedBy.email})` : ""}
                </p>

                <ul className="bm-approval-changes">
                  {Object.entries(request.changes).map(([key, value]) => (
                    <li key={key}>
                      <span>{FIELD_LABEL[key] || key}</span>
                      <s>{request.previous?.[key] || "(empty)"}</s>
                      <b>{value || "(empty)"}</b>
                    </li>
                  ))}
                </ul>

                {request.note && <p className="bm-approval-note">Note: {request.note}</p>}

                {request.status === "pending" ? (
                  <div className="bm-approval-actions">
                    <AsyncButton className="bm-btn bm-btn-primary" onClick={() => review(request, "approve")}>
                      <Check size={15} /> Approve
                    </AsyncButton>
                    <AsyncButton className="bm-btn bm-btn-danger" onClick={() => review(request, "reject")}>
                      <X size={15} /> Reject
                    </AsyncButton>
                  </div>
                ) : (
                  <p className="bm-muted">
                    {request.status === "approved" ? "Approved" : "Rejected"} by {request.reviewedBy || "head office"} on{" "}
                    {when(request.reviewedAt)}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}

        {error && (
          <div className="bm-error" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
