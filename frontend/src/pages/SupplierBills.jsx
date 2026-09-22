import { useEffect, useState } from "react";
import API from "../api/axios";

export default function SupplierBills() {
  const [purchases, setPurchases] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);

  const fetchBills = async () => {
    try {
      const res = await API.get("/purchases");
      setPurchases(res.data.purchases || []);
    } catch (error) {
      alert(error.response?.data?.message || "Supplier bills fetch failed");
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const getStatus = (bill) => {
    if (Number(bill.pendingAmount || 0) <= 0) return "Paid";
    if (Number(bill.paidAmount || 0) > 0) return "Partially Paid";
    return "Pending";
  };

  return (
    <div className="settings-page">
      <div className="settings-head">
        <div>
          <h1>Supplier Bills</h1>
          <p>Review GRN invoices, supplier totals, paid amounts, pending balances and status</p>
        </div>
      </div>

      <div className="panel">
        <h2>All Supplier Bills</h2>

        <table>
          <thead>
            <tr>
              <th>Bill No</th>
              <th>Vendor</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Pending</th>
              <th>Status</th>
              <th>View</th>
            </tr>
          </thead>

          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan="7">No supplier bill found</td>
              </tr>
            ) : (
              purchases.map((p) => (
                <tr key={p._id}>
                  <td>{p.invoiceNo}</td>
                  <td>{p.vendorName}</td>
                  <td>₹{p.grandTotal}</td>
                  <td>₹{p.paidAmount}</td>
                  <td>₹{p.pendingAmount}</td>
                  <td>{getStatus(p)}</td>
                  <td>
                    <button onClick={() => setSelectedBill(p)}>View</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedBill && (
        <div className="sales-return-modal-overlay">
          <div className="sales-return-modal">
            <div className="sales-return-modal-head">
              <h2>Supplier Bill Details</h2>
              <button onClick={() => setSelectedBill(null)}>×</button>
            </div>

            <div className="sales-return-info-grid">
              <div>
                <span>Bill No</span>
                <b>{selectedBill.invoiceNo}</b>
              </div>

              <div>
                <span>Vendor</span>
                <b>{selectedBill.vendorName}</b>
              </div>

              <div>
                <span>Total</span>
                <b>₹{selectedBill.grandTotal}</b>
              </div>

              <div>
                <span>Status</span>
                <b>{getStatus(selectedBill)}</b>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Qty</th>
                  <th>Purchase</th>
                  <th>GST</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {selectedBill.products?.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.barcode}</td>
                    <td>{item.qty}</td>
                    <td>₹{item.purchasePrice}</td>
                    <td>{item.gst}%</td>
                    <td>₹{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
