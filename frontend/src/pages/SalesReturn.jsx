import { useEffect, useState } from "react";
import API from "../api/axios";
import { ToastViewport, useToast } from "../components/Toast";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

export default function SalesReturn() {
  const [returns, setReturns] = useState([]);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast, showToast } = useToast();

  const fetchReturns = async () => {
    const res = await API.get("/sales-return");
    setReturns(res.data.returns || []);
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const formatDate = (date) => {
    if (!date) return "N/A";

    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const deleteReturn = async (password) => {
    if (!deleteTarget) return;

    try {
      await API.delete(`/sales-return/${deleteTarget._id}`, { data: { password } });

      showToast("Sales return deleted successfully", "success");

      setSelectedReturn(null);
      setDeleteTarget(null);
      fetchReturns();
    } catch (error) {
      showToast(error.response?.data?.message || "Sales return delete failed");
    }
  };

  return (
    <div className="sales-return-page">
      <ToastViewport toast={toast} />
      <div className="page-head">
        <div>
          <h1>Sales Return / Refund</h1>
          <p>Track returned invoices, refundable items, return quantities and stock adjustments</p>
        </div>
      </div>

      <div className="sales-return-card">
        <h2>All Sales Returns</h2>

        <table>
          <thead>
            <tr>
              <th>Return No</th>
              <th>Invoice No</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Return Amount</th>
              <th>Date</th>
              <th>Info</th>
            </tr>
          </thead>

          <tbody>
            {returns.length === 0 ? (
              <tr>
                <td colSpan="7">No sales return found</td>
              </tr>
            ) : (
              returns.map((r) => (
                <tr key={r._id}>
                  <td>{r.returnNo || "N/A"}</td>
                  <td>{r.invoiceNo}</td>
                  <td>{r.customerName}</td>
                  <td>{r.customerPhone}</td>
                  <td>₹{r.returnAmount}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>
                    <button
                      className="sales-return-info-btn"
                      onClick={() => setSelectedReturn(r)}
                    >
                      i
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedReturn && (
        <div className="sales-return-modal-overlay">
          <div className="sales-return-modal">
            <div className="sales-return-modal-head">
              <h2>Return Details</h2>
              <button onClick={() => setSelectedReturn(null)}>×</button>
            </div>

            <div className="sales-return-info-grid">
              <div>
                <span>Return No</span>
                <b>{selectedReturn.returnNo || "N/A"}</b>
              </div>

              <div>
                <span>Invoice No</span>
                <b>{selectedReturn.invoiceNo}</b>
              </div>

              <div>
                <span>Customer</span>
                <b>{selectedReturn.customerName}</b>
              </div>

              <div>
                <span>Phone</span>
                <b>{selectedReturn.customerPhone}</b>
              </div>

              <div>
                <span>Return Amount</span>
                <b>₹{selectedReturn.returnAmount}</b>
              </div>

              <div>
                <span>Date</span>
                <b>{formatDate(selectedReturn.createdAt)}</b>
              </div>
            </div>

            <h3>Returned Products</h3>

            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>GST</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {selectedReturn.products?.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{p.barcode}</td>
                    <td>{p.qty}</td>
                    <td>₹{p.rate}</td>
                    <td>{p.gst}%</td>
                    <td>₹{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button className="delete-sales-return-btn" onClick={() => setDeleteTarget(selectedReturn)}>
              Delete Sales Return
            </button>
          </div>
        </div>
      )}
      <DeleteConfirmModal
        open={!!deleteTarget}
        title={`Delete return ${deleteTarget?.returnNo || ""}?`}
        message="Return stock reversal will be applied. Enter login password to continue."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteReturn}
      />
    </div>
  );
}
