import { useEffect, useState } from "react";
import API from "../api/axios";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

const emptyCoupon = {
  code: "",
  discountType: "Amount",
  discountValue: "",
  minimumBillAmount: 0,
  usageLimit: 0,
  startDate: "",
  endDate: "",
  status: "Active",
};

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(emptyCoupon);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchCoupons = async () => {
    const res = await API.get("/coupons");
    setCoupons(res.data.coupons || []);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const submit = async (e) => {
    e.preventDefault();

    try {
      await API.post("/coupons", form);
      alert("Coupon created successfully");
      setForm(emptyCoupon);
      fetchCoupons();
    } catch (error) {
      alert(error.response?.data?.message || "Coupon create failed");
    }
  };

  const remove = async (password) => {
    if (!deleteTarget) return;

    await API.delete(`/coupons/${deleteTarget._id}`, { data: { password } });
    setDeleteTarget(null);
    fetchCoupons();
  };

  return (
    <div className="settings-page">
      <div className="settings-head">
        <div>
          <h1>Coupon Management</h1>
          <p>Create, update and control invoice discount coupons for billing offers</p>
        </div>
      </div>

      <form className="panel form-grid" onSubmit={submit}>
        <input
          placeholder="Coupon Code"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          required
        />

        <select
          value={form.discountType}
          onChange={(e) => setForm({ ...form, discountType: e.target.value })}
        >
          <option value="Amount">Amount</option>
          <option value="Percent">Percent</option>
        </select>

        <input
          type="number"
          placeholder="Discount Value"
          value={form.discountValue}
          onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
          required
        />

        <input
          type="number"
          placeholder="Minimum Bill Amount"
          value={form.minimumBillAmount}
          onChange={(e) => setForm({ ...form, minimumBillAmount: e.target.value })}
        />

        <input
          type="number"
          placeholder="Usage Limit"
          value={form.usageLimit}
          onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
        />

        <input
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
        />

        <input
          type="date"
          value={form.endDate}
          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
        />

        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <button>Create Coupon</button>
      </form>

      <div className="panel">
        <h2>All Coupons</h2>

        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Value</th>
              <th>Min Bill</th>
              <th>Usage</th>
              <th>Status</th>
              <th>Delete</th>
            </tr>
          </thead>

          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan="7">No coupon found</td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c._id}>
                  <td><b>{c.code}</b></td>
                  <td>{c.discountType}</td>
                  <td>{c.discountType === "Percent" ? `${c.discountValue}%` : `₹${c.discountValue}`}</td>
                  <td>₹{c.minimumBillAmount}</td>
                  <td>{c.usedCount || 0}/{c.usageLimit || "Unlimited"}</td>
                  <td>{c.status}</td>
                  <td>
                    <button onClick={() => setDeleteTarget(c)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <DeleteConfirmModal
        open={!!deleteTarget}
        title={`Delete coupon ${deleteTarget?.code || ""}?`}
        message="Coupon will be deleted. Enter login password to continue."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
      />
    </div>
  );
}
