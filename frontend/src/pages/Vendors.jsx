import AsyncForm from "../components/AsyncForm";
import AsyncButton from "../components/AsyncButton";
import { useEffect, useState } from "react";
import API from "../api/axios";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import PhoneInput from "../components/PhoneInput";
import { X } from "lucide-react";

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    gstNumber: "",
    address: "",
    openingBalance: "",
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [ledgerVendor, setLedgerVendor] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);

  const fetchVendors = async () => {
    const res = await API.get("/vendors");
    setVendors(res.data.vendors);
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await API.post("/vendors", { ...form, openingBalance: Number(form.openingBalance || 0) });
    setForm({ name: "", phone: "", email: "", gstNumber: "", address: "", openingBalance: "" });
    fetchVendors();
  };

  const remove = async (password) => {
    if (!deleteTarget) return;
    await API.delete(`/vendors/${deleteTarget._id}`, { data: { password } });
    setDeleteTarget(null);
    fetchVendors();
  };

  const openLedger = async (vendor) => {
    setLedgerVendor(vendor);
    try {
      const res = await API.get(`/vendors/${vendor._id}/ledger`);
      setLedgerData(res.data);
    } catch {
      setLedgerData(null);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Vendor Management</h1>
          <p>Manage supplier profiles, GST details, opening balances, purchases and payments</p>
        </div>
      </div>

      <AsyncForm className="panel form-grid" onSubmit={submit}>
        <input placeholder="Vendor Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <PhoneInput placeholder="Mobile number" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="GST Number" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
        <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input type="number" placeholder="Opening Balance" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} />
        <button>Add Vendor</button>
      </AsyncForm>

      <div className="panel">
        <h2>Vendor Dashboard</h2>
        <table>
          <thead>
            <tr>
              <th>Vendor</th><th>Total Purchase</th><th>Paid</th><th>Pending</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v._id}>
                <td>{v.name}</td>
                <td>₹{v.totalPurchase}</td>
                <td>₹{v.paidAmount}</td>
                <td>₹{v.pendingAmount}</td>
                <td>{v.status}</td>
                <td>
                  <AsyncButton onClick={() => openLedger(v)}>Ledger</AsyncButton>{" "}
                  <button onClick={() => setDeleteTarget(v)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ledgerVendor && (
        <div className="modal-overlay">
          <div className="modal-card large">
            <div className="modal-head">
              <h2>Ledger - {ledgerVendor.name}</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" title="Close" onClick={() => { setLedgerVendor(null); setLedgerData(null); }}><X size={20} strokeWidth={2.5} /></button>
            </div>
            {!ledgerData ? (
              <p>Loading...</p>
            ) : (
              <>
                <div className="restaurant-stats-grid">
                  <div><span>Total Purchase</span><b>₹{ledgerData.totalPurchase}</b></div>
                  <div><span>Total Paid</span><b>₹{ledgerData.totalPaid}</b></div>
                  <div><span>Outstanding</span><b>₹{ledgerData.outstanding}</b></div>
                </div>
                <table>
                  <thead>
                    <tr><th>Date</th><th>Type</th><th>Ref No</th><th>Debit (Purchase)</th><th>Credit (Paid)</th></tr>
                  </thead>
                  <tbody>
                    {ledgerData.ledger.length === 0 ? (
                      <tr><td colSpan="5">No ledger entries</td></tr>
                    ) : (
                      ledgerData.ledger.map((entry) => (
                        <tr key={entry.refId}>
                          <td>{new Date(entry.date).toLocaleDateString("en-IN")}</td>
                          <td>{entry.type}</td>
                          <td>{entry.refNo || "N/A"}</td>
                          <td>{entry.debit ? `₹${entry.debit}` : "-"}</td>
                          <td>{entry.credit ? `₹${entry.credit}` : "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name || "vendor"}?`}
        message="Vendor record will be deleted. Enter login password to continue."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
      />
    </div>
  );
}
