import { useEffect, useState } from "react";
import API from "../api/axios";

export default function Accounts() {
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);

  const [form, setForm] = useState({
    paymentAmount: "",
    paymentMode: "Cash",
    paymentNote: "",
    referenceNumber: "",
  });

  const fetchData = async () => {
    const billsRes = await API.get("/accounts/pending-bills");
    const payRes = await API.get("/accounts/vendor-payments");

    setBills(billsRes.data.bills || []);
    setPayments(payRes.data.payments || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const submitPayment = async (e) => {
    e.preventDefault();

    if (!selectedBill) return alert("Please select a supplier bill");

    try {
      await API.post("/accounts/vendor-payment", {
        purchaseId: selectedBill._id,
        ...form,
      });

      alert("Vendor payment added successfully");

      setSelectedBill(null);
      setForm({
        paymentAmount: "",
        paymentMode: "Cash",
        paymentNote: "",
        referenceNumber: "",
      });

      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || "Payment failed");
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-head">
        <div>
          <h1>Accounts Payable</h1>
          <p>Manage supplier pending balances, paid amounts and vendor payment history</p>
        </div>
      </div>

      <div className="two-grid">
        <div className="panel">
          <h2>Pending Supplier Bills</h2>

          <table>
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Vendor</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Pending</th>
                <th>Select</th>
              </tr>
            </thead>

            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan="6">No pending bill found</td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b._id}>
                    <td>{b.invoiceNo}</td>
                    <td>{b.vendorName}</td>
                    <td>₹{b.grandTotal}</td>
                    <td>₹{b.paidAmount}</td>
                    <td>₹{b.pendingAmount}</td>
                    <td>
                      <button onClick={() => setSelectedBill(b)}>Pay</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form className="panel form-grid" onSubmit={submitPayment}>
          <h2>Add Vendor Payment</h2>

          <input
            value={selectedBill?.vendorName || ""}
            placeholder="Vendor Name"
            readOnly
          />

          <input
            value={selectedBill?.invoiceNo || ""}
            placeholder="Supplier Bill Number"
            readOnly
          />

          <input
            value={selectedBill?.grandTotal || ""}
            placeholder="Total Bill Amount"
            readOnly
          />

          <input
            value={selectedBill?.paidAmount || ""}
            placeholder="Already Paid"
            readOnly
          />

          <input
            value={selectedBill?.pendingAmount || ""}
            placeholder="Pending Amount"
            readOnly
          />

          <input
            type="number"
            placeholder="Payment Amount"
            value={form.paymentAmount}
            onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })}
            required
          />

          <select
            value={form.paymentMode}
            onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
          >
            <option>Cash</option>
            <option>UPI</option>
            <option>Card</option>
            <option>Bank Transfer</option>
            <option>Other</option>
          </select>

          <input
            placeholder="Reference Number"
            value={form.referenceNumber}
            onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
          />

          <textarea
            placeholder="Payment Note"
            value={form.paymentNote}
            onChange={(e) => setForm({ ...form, paymentNote: e.target.value })}
          />

          <button>Add Payment</button>
        </form>
      </div>

      <div className="panel">
        <h2>Payment History</h2>

        <table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Bill No</th>
              <th>Amount</th>
              <th>Mode</th>
              <th>Reference</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan="6">No payment history found</td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p._id}>
                  <td>{p.vendorName}</td>
                  <td>{p.supplierBillNumber}</td>
                  <td>₹{p.paymentAmount}</td>
                  <td>{p.paymentMode}</td>
                  <td>{p.referenceNumber || "N/A"}</td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
