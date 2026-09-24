import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import API from "../api/axios";
import { SkeletonCards, SkeletonTable } from "../components/Skeleton";

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
];

const dateLabel = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

// Branch-side royalty screen: the rate head office set for this branch, what it comes
// to for each period, and the sales those figures are calculated from. All numbers are
// computed on the server from this branch's own sales (see utils/royalty.js).
export default function RoyaltyManagement() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    API.get("/dashboard/royalty")
      .then((res) => alive && setData(res.data))
      .catch((cause) => alive && setError(cause.response?.data?.message || "Could not load royalty details"));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="bm-page">
        <div className="bm-head">
          <div>
            <h1>Royalty Management</h1>
          </div>
        </div>
        <div className="bm-error" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bm-page">
        <div className="bm-head">
          <div>
            <h1>Royalty Management</h1>
            <p>Royalty payable to head office, and the sales it is calculated from.</p>
          </div>
        </div>
        <SkeletonCards count={3} />
        <SkeletonTable rows={3} columns={7} />
      </div>
    );
  }

  const { branch, periods } = data;
  const baseLabel = periods.month.royalty.baseLabel;
  const hasRoyalty = Number(branch.royaltyPercent) > 0;

  return (
    <div className="bm-page">
      <div className="bm-head">
        <div>
          <h1>Royalty Management</h1>
          <p>
            Royalty payable to head office for {branch.name} ({branch.code}).
          </p>
        </div>
        <span className="bm-royalty-rate">
          <Landmark size={15} /> {branch.royaltyPercent}% of {baseLabel.toLowerCase()}
        </span>
      </div>

      {!hasRoyalty ? (
        <div className="bm-card bm-empty">No royalty has been set for this branch.</div>
      ) : (
        <>
          <div className="bm-kpis">
            {PERIODS.map(({ key, label }) => (
              <div key={key} className={`bm-kpi${key === "month" ? " bm-kpi-accent" : ""}`}>
                <span>{label}</span>
                <strong>{money(periods[key].royalty.amount)}</strong>
                <small>
                  on {money(periods[key].royalty.baseAmount)} {baseLabel.toLowerCase()}
                </small>
              </div>
            ))}
          </div>

          <div className="bm-card">
            <h2 className="bm-section-title">How each figure is calculated</h2>
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Dates</th>
                    <th className="num">Bills</th>
                    <th className="num">Gross sales</th>
                    <th className="num">Net (excl. GST)</th>
                    <th className="num">Royalty base</th>
                    <th className="num">Royalty</th>
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map(({ key, label }) => {
                    const period = periods[key];
                    return (
                      <tr key={key}>
                        <td>
                          <span className="bm-branch-name">{label}</span>
                        </td>
                        <td className="bm-muted">
                          {dateLabel(period.range.start)} - {dateLabel(period.range.end)}
                        </td>
                        <td className="num">{period.sales.bills}</td>
                        <td className="num">{money(period.sales.grossIncGst)}</td>
                        <td className="num">{money(period.sales.netExGst)}</td>
                        <td className="num">{money(period.royalty.baseAmount)}</td>
                        <td className="num">
                          <b>{money(period.royalty.amount)}</b>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
