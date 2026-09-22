import { useEffect, useMemo, useState } from "react";
import { Info, Search, Trash2 } from "lucide-react";
import API from "../api/axios";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

export default function Reports() {
  const [sales, setSales] = useState([]);
  const [restaurantOrders, setRestaurantOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchReports = async () => {
    const [saleRes, orderRes] = await Promise.all([
      API.get("/sales"),
      API.get("/restaurant-orders"),
    ]);
    setSales(saleRes.data.sales || []);
    setRestaurantOrders(orderRes.data.orders || []);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const deleteReport = async (row) => {
    setDeleteTarget(row);
  };

  const confirmDeleteReport = async (password) => {
    const row = deleteTarget;
    await API.delete(row.reportType === "restaurant" ? `/restaurant-orders/${row._id}` : `/sales/${row._id}`, {
      data: { password },
    });
    if (selectedReport?._id === row._id) {
      setSelectedReport(null);
    }
    setDeleteTarget(null);
    fetchReports();
  };

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

  const rows = useMemo(() => {
    const saleRows = sales.map((sale) => ({
      ...sale,
      reportType: "sale",
      reportNo: sale.invoiceNo,
      customer: sale.customerName || "Walk-in",
      phone: sale.customerPhone || "",
      title: "Counter Sale",
      total: Number(sale.grandTotal || 0),
      date: sale.createdAt,
      status: sale.paymentStatus || "paid",
      items: sale.products || [],
    }));

    const orderRows = restaurantOrders.map((order) => ({
      ...order,
      reportType: "restaurant",
      reportNo: order.invoiceNo || order.orderNo,
      customer: order.customerName || "Customer",
      phone: order.customerPhone || "",
      title: order.orderType === "delivery" ? "Delivery" : `Table ${order.tableNo}`,
      total: Number(order.grandTotal || 0),
      date: order.createdAt,
      status: order.paymentStatus === "paid" ? "paid" : order.status,
      items: order.items || [],
    }));

    const q = search.toLowerCase().trim();
    return [...orderRows, ...saleRows]
      .filter((row) => {
        if (!q) return true;
        return (
          row.reportNo?.toLowerCase().includes(q) ||
          row.customer?.toLowerCase().includes(q) ||
          row.phone?.toLowerCase().includes(q) ||
          row.title?.toLowerCase().includes(q) ||
          row.items?.some((item) => item.name?.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [restaurantOrders, sales, search]);

  return (
    <div className="reports-page">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>Restaurant orders, sales, customer names, totals and complete bill details.</p>
        </div>
      </div>

      <div className="panel">
        <div className="reports-toolbar">
          <h2>All Orders & Sales</h2>
          <label>
            <Search size={18} />
            <input
              placeholder="Search order, customer, phone, item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Name</th>
              <th>Price</th>
              <th>Status</th>
              <th>Info</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="8">No report found</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.reportType}-${row._id}`}>
                  <td>{row.reportNo}</td>
                  <td>{formatDate(row.date)}</td>
                  <td>{row.customer}</td>
                  <td>{row.title}</td>
                  <td>Rs {row.total.toFixed(2)}</td>
                  <td><span className={`report-status ${row.status}`}>{row.status}</span></td>
                  <td>
                    <button className="report-info-btn" onClick={() => setSelectedReport(row)}>
                      <Info size={15} />
                    </button>
                  </td>
                  <td>
                    <button className="report-delete-btn" onClick={() => deleteReport(row)}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedReport && (
        <div className="report-modal-overlay">
          <div className="report-modal">
            <div className="report-modal-head">
              <h2>{selectedReport.reportType === "restaurant" ? "Restaurant Order" : "Invoice"} Details</h2>
              <button onClick={() => setSelectedReport(null)}>x</button>
            </div>

            <div className="report-info-grid">
              <InfoBlock label="No" value={selectedReport.reportNo} />
              <InfoBlock label="Date" value={formatDate(selectedReport.date)} />
              <InfoBlock label="Customer" value={selectedReport.customer} />
              <InfoBlock label="Mobile" value={selectedReport.phone || "N/A"} />
              <InfoBlock label="Type" value={selectedReport.title} />
              <InfoBlock label="Status" value={selectedReport.status} />
              <InfoBlock label="Sub Total" value={`Rs ${Number(selectedReport.subTotal || selectedReport.total || 0).toFixed(2)}`} />
              <InfoBlock label="GST" value={`Rs ${Number(selectedReport.gstAmount || 0).toFixed(2)}`} />
              <InfoBlock label="Discount" value={`Rs ${Number(selectedReport.discountAmount || 0).toFixed(2)}`} />
              <InfoBlock label="Grand Total" value={`Rs ${Number(selectedReport.total || 0).toFixed(2)}`} />
            </div>

            <h3>Items</h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>GST</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedReport.items?.map((item, index) => (
                  <tr key={`${item.productId || item.barcode || item.name}-${index}`}>
                    <td>{item.name}</td>
                    <td>{item.category || item.barcode || "N/A"}</td>
                    <td>{item.qty}</td>
                    <td>Rs {Number(item.rate || 0).toFixed(2)}</td>
                    <td>{Number(item.gst || 0)}%</td>
                    <td>Rs {Number(item.total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button className="report-delete-detail-btn" onClick={() => deleteReport(selectedReport)}>
              <Trash2 size={16} />
              Delete This Record
            </button>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.reportNo || "record"}?`}
        message="Stock will be restored for its items. Enter login password to continue."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteReport}
      />
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
