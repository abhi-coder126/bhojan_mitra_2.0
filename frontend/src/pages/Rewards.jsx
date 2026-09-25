import AsyncForm from "../components/AsyncForm";
import AsyncButton from "../components/AsyncButton";
import { useEffect, useState } from "react";
import API from "../api/axios";
import { SkeletonTable } from "../components/Skeleton";
import ConfirmActionModal from "../components/ConfirmActionModal";

const emptyTier = {
  title: "",
  minOrders: 1,
  offerType: "percent",
  offerValue: "",
  offerText: "",
  validityDays: 7,
  isActive: true,
};

export default function Rewards() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issued, setIssued] = useState([]);
  const [form, setForm] = useState(emptyTier);

  const fetchTiers = async () => {
    const res = await API.get("/rewards/tiers");
    setTiers(res.data.tiers || []);
  };

  const fetchIssued = async () => {
    const res = await API.get("/rewards/issued");
    setIssued(res.data.rewards || []);
  };

  useEffect(() => {
    Promise.all([fetchTiers(), fetchIssued()]).finally(() => setLoading(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();

    try {
      await API.post("/rewards/tiers", form);
      alert("Reward tier created");
      setForm(emptyTier);
      fetchTiers();
    } catch (error) {
      alert(error.response?.data?.message || "Could not create reward tier");
    }
  };

  const [deleteId, setDeleteId] = useState(null);

  const toggleActive = async (tier) => {
    await API.put(`/rewards/tiers/${tier._id}`, { isActive: !tier.isActive });
    fetchTiers();
  };

  // In-app dialog instead of window.confirm, which cannot be styled.
  const remove = (id) => setDeleteId(id);

  return (
    <div className="settings-page">
      <div className="settings-head">
        <div>
          <h1>Customer Rewards</h1>
          <p>
            Set how many delivery orders a customer needs before they win an offer. When their order is marked
            served, they get a scratch card on their profile with the offer revealed and a validity window.
          </p>
        </div>
      </div>

      <AsyncForm className="panel form-grid" onSubmit={submit}>
        <input
          placeholder="Tier title (e.g. First Order Bonus)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />

        <input
          type="number"
          min="1"
          placeholder="Orders needed"
          value={form.minOrders}
          onChange={(e) => setForm({ ...form, minOrders: e.target.value })}
          required
        />

        <select value={form.offerType} onChange={(e) => setForm({ ...form, offerType: e.target.value })}>
          <option value="percent">% discount</option>
          <option value="flat">Flat amount off</option>
          <option value="freebie">Free item</option>
        </select>

        <input
          type="number"
          placeholder={form.offerType === "freebie" ? "Value (optional)" : "Offer value"}
          value={form.offerValue}
          onChange={(e) => setForm({ ...form, offerValue: e.target.value })}
        />

        <input
          placeholder="Offer text shown to customer (e.g. 20% OFF your next order)"
          value={form.offerText}
          onChange={(e) => setForm({ ...form, offerText: e.target.value })}
          required
        />

        <input
          type="number"
          min="1"
          placeholder="Validity (days)"
          value={form.validityDays}
          onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
        />

        <button>Create Reward Tier</button>
      </AsyncForm>

      <div className="panel">
        <h2>Reward Tiers</h2>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Orders Needed</th>
              <th>Offer</th>
              <th>Validity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="table-loading-cell">
                  <SkeletonTable rows={4} columns={6} />
                </td>
              </tr>
            ) : tiers.length === 0 ? (
              <tr>
                <td colSpan="6">No reward tiers yet</td>
              </tr>
            ) : (
              tiers.map((tier) => (
                <tr key={tier._id}>
                  <td><b>{tier.title}</b></td>
                  <td>{tier.minOrders}+ orders</td>
                  <td>{tier.offerText}</td>
                  <td>{tier.validityDays} days</td>
                  <td>{tier.isActive ? "Active" : "Paused"}</td>
                  <td>
                    <div className="row-actions">
                      <AsyncButton onClick={() => toggleActive(tier)}>{tier.isActive ? "Pause" : "Activate"}</AsyncButton>
                      <AsyncButton onClick={() => remove(tier._id)}>Delete</AsyncButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Recently Issued Rewards</h2>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Order</th>
              <th>Reward</th>
              <th>Scratched</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="table-loading-cell">
                  <SkeletonTable rows={4} columns={5} />
                </td>
              </tr>
            ) : issued.length === 0 ? (
              <tr>
                <td colSpan="5">No rewards issued yet</td>
              </tr>
            ) : (
              issued.map((reward) => (
                <tr key={reward._id}>
                  <td>{reward.customerId?.name || "-"} ({reward.customerId?.crn || "-"})</td>
                  <td>{reward.orderId?.orderNo || "-"}</td>
                  <td>{reward.title}</td>
                  <td>{reward.scratched ? "Yes" : "Waiting"}</td>
                  <td>{new Date(reward.expiresAt).toLocaleDateString("en-IN")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ConfirmActionModal
        open={Boolean(deleteId)}
        title="Delete this reward tier?"
        message="Customers will stop earning this reward. Rewards already issued are not affected."
        confirmText="Delete tier"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          await API.delete(`/rewards/tiers/${deleteId}`);
          setDeleteId(null);
          fetchTiers();
        }}
      />
    </div>
  );
}
