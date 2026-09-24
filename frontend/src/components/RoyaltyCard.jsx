import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import API from "../api/axios";

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
];

// Branch dashboard: the royalty rate head office set for this branch and what it
// comes to. Calculated on the server from this branch's own sales.
export default function RoyaltyCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    API.get("/dashboard/royalty")
      .then((res) => alive && setData(res.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return null;

  const { branch, periods } = data;
  const baseLabel = periods.month.royalty.baseLabel;

  return (
    <section className="bm-royalty-card" aria-label="Royalty">
      <div className="bm-royalty-head">
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Landmark size={18} color="#84091e" /> Royalty payable to head office
        </h2>
        <span className="bm-royalty-rate">
          {branch.royaltyPercent}% of {baseLabel.toLowerCase()}
        </span>
      </div>

      {Number(branch.royaltyPercent) === 0 ? (
        <p className="bm-muted" style={{ margin: 0 }}>
          No royalty has been set for this branch.
        </p>
      ) : (
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
      )}
    </section>
  );
}
