import { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
export default function GRNManagement() {
    const [purchases, setPurchases] = useState([]);
    const [selectedGRN, setSelectedGRN] = useState(null);
    const [modalMode, setModalMode] = useState("view");
    const [searchVendor, setSearchVendor] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 20;

    const fetchPurchases = async () => {
        try {
            const res = await API.get("/purchases");
            setPurchases(res.data.purchases || []);
        } catch (error) {
            console.log("GRN Fetch Error:", error.response?.data || error.message);
            alert(error.response?.data?.message || "GRN fetch failed");
        }
    };

    useEffect(() => {
        fetchPurchases();
    }, []);

    const filteredPurchases = useMemo(() => {
        const q = searchVendor.toLowerCase().trim();

        return purchases.filter((p) => {
            return (
                p.vendorName?.toLowerCase().includes(q) ||
                p.invoiceNo?.toLowerCase().includes(q) ||
                String(p.grandTotal || "").includes(q)
            );
        });
    }, [purchases, searchVendor]);

    const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage) || 1;

    const paginatedPurchases = filteredPurchases.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const viewGRN = async (id, mode = "view") => {
        try {
            const res = await API.get(`/purchases/${id}`);
            setSelectedGRN(res.data.purchase);
            setModalMode(mode);
        } catch (error) {
            alert(error.response?.data?.message || "GRN details fetch failed");
        }
    };

    const updateProductField = (index, field, value) => {
        const updated = {
            ...selectedGRN,
            products: [...selectedGRN.products],
        };

        updated.products[index] = {
            ...updated.products[index],
            [field]: value,
        };

        const qty = Number(updated.products[index].qty || 0);
        const purchasePrice = Number(updated.products[index].purchasePrice || 0);

        updated.products[index].total = qty * purchasePrice;

        setSelectedGRN(updated);
    };

    const increaseQty = (index) => {
        const updated = {
            ...selectedGRN,
            products: [...selectedGRN.products],
        };

        updated.products[index] = {
            ...updated.products[index],
            qty: Number(updated.products[index].qty || 0) + 1,
        };

        updated.products[index].total =
            Number(updated.products[index].qty) *
            Number(updated.products[index].purchasePrice || 0);

        setSelectedGRN(updated);
    };

    const decreaseQty = (index) => {
        const updated = {
            ...selectedGRN,
            products: [...selectedGRN.products],
        };

        updated.products[index] = {
            ...updated.products[index],
            qty:
                Number(updated.products[index].qty) > 1
                    ? Number(updated.products[index].qty) - 1
                    : 1,
        };

        updated.products[index].total =
            Number(updated.products[index].qty) *
            Number(updated.products[index].purchasePrice || 0);

        setSelectedGRN(updated);
    };

    const removeProduct = (index) => {
        const updated = {
            ...selectedGRN,
            products: selectedGRN.products.filter((_, i) => i !== index),
        };

        setSelectedGRN(updated);
    };

    const totalAmount =
        selectedGRN?.products?.reduce((sum, item) => {
            return sum + Number(item.purchasePrice || 0) * Number(item.qty || 0);
        }, 0) || 0;

    const gstAmount =
        selectedGRN?.products?.reduce((sum, item) => {
            const base = Number(item.purchasePrice || 0) * Number(item.qty || 0);
            return sum + (base * Number(item.gst || 0)) / 100;
        }, 0) || 0;

    const grandTotal = totalAmount + gstAmount;
    const modalPending = Math.max(
        grandTotal - Number(selectedGRN?.paidAmount || 0),
        0
    );

    const saveGRNUpdate = async () => {
        if (!selectedGRN) return;

        try {
            await API.put(`/purchases/${selectedGRN._id}/full-update`, {
                products: selectedGRN.products,
                paidAmount: selectedGRN.paidAmount,
                paymentMode: selectedGRN.paymentMode,
            });

            alert("GRN updated successfully");
            setSelectedGRN(null);
            fetchPurchases();
        } catch (error) {
            alert(error.response?.data?.message || "GRN update failed");
        }
    };

    return (
        <div className="grn-management-page">
            <div className="grn-hero">
                <div>
                    <span className="grn-kicker">Purchase Control</span>
                    <h1>GRN Management</h1>
                    <p>
                        Review received stock, edit purchase quantities, update GST,
                        pricing and vendor payments.
                    </p>
                </div>

                <div className="grn-hero-card">
                    <span>Total GRN</span>
                    <strong>{purchases.length}</strong>
                </div>
            </div>

            <div className="grn-stats-grid">
                <div className="grn-stat-card">
                    <span>Total Purchase</span>
                    <strong>
                        ₹
                        {purchases.reduce(
                            (sum, item) => sum + Number(item.grandTotal || 0),
                            0
                        )}
                    </strong>
                </div>

                <div className="grn-stat-card">
                    <span>Total Paid</span>
                    <strong>
                        ₹
                        {purchases.reduce(
                            (sum, item) => sum + Number(item.paidAmount || 0),
                            0
                        )}
                    </strong>
                </div>

                <div className="grn-stat-card danger">
                    <span>Total Pending</span>
                    <strong>
                        ₹
                        {purchases.reduce(
                            (sum, item) => sum + Number(item.pendingAmount || 0),
                            0
                        )}
                    </strong>
                </div>
            </div>

            <div className="grn-panel">
                <div className="grn-panel-head">
                    <div>
                        <h2>GRN & Purchase Records</h2>
                        <p>Search and manage vendor GRNs by supplier name, invoice number or bill amount.</p>
                    </div>

                    <div className="grn-search-box">
                        <input
                            placeholder="Search vendor / invoice / amount..."
                            value={searchVendor}
                            onChange={(e) => {
                                setSearchVendor(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                </div>

                <div className="grn-table-wrap">
                    <table className="grn-table">
                        <thead>
                            <tr>
                                <th>Invoice</th>
                                <th>Vendor</th>
                                <th>Total</th>
                                <th>Paid</th>
                                <th>Pending</th>
                                <th>Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedPurchases.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-row">
                                        No GRN found
                                    </td>
                                </tr>
                            ) : (
                                paginatedPurchases.map((p) => (
                                    <tr key={p._id}>
                                        <td>
                                            <strong>{p.invoiceNo}</strong>
                                        </td>
                                        <td>{p.vendorName}</td>
                                        <td>₹{p.grandTotal}</td>
                                        <td>₹{p.paidAmount}</td>
                                        <td>
                                            <span
                                                className={
                                                    Number(p.pendingAmount || 0) > 0
                                                        ? "pending-badge"
                                                        : "paid-badge"
                                                }
                                            >
                                                ₹{p.pendingAmount}
                                            </span>
                                        </td>
                                        <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <div className="grn-action-buttons">
                                                <button
                                                    className="view-btn"
                                                    onClick={() => viewGRN(p._id, "view")}
                                                >
                                                    View
                                                </button>
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => viewGRN(p._id, "edit")}
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="grn-pagination">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                    >
                        Previous
                    </button>

                    <span>
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                    >
                        Next
                    </button>
                </div>
            </div>
            {selectedGRN && (
                <div className="grn-modal-overlay">
                    <div className="grn-modal">
                        <div className="grn-modal-head">
                            <div>
                                <span>{modalMode === "view" ? "View Mode" : "Edit Mode"}</span>
                                <h2>
                                    {modalMode === "view" ? "GRN Details" : "Edit GRN"} -{" "}
                                    {selectedGRN.invoiceNo}
                                </h2>
                            </div>

                            <button onClick={() => setSelectedGRN(null)}>×</button>
                        </div>

                        <div className="grn-modal-scroll">
                            <div className="grn-info-grid">
                                <div className="grn-info-card">
                                    <h3>Vendor Details</h3>

                                    <div className="info-row">
                                        <span>Vendor</span>
                                        <strong>{selectedGRN.vendorName}</strong>
                                    </div>

                                    <div className="info-row">
                                        <span>Invoice No</span>
                                        <strong>{selectedGRN.invoiceNo}</strong>
                                    </div>

                                    <div className="info-row">
                                        <span>Date</span>
                                        <strong>
                                            {new Date(selectedGRN.createdAt).toLocaleDateString()}
                                        </strong>
                                    </div>
                                </div>

                                <div className="grn-info-card">
                                    <h3>Payment</h3>

                                    {modalMode === "view" ? (
                                        <>
                                            <div className="info-row">
                                                <span>Paid</span>
                                                <strong>₹{selectedGRN.paidAmount}</strong>
                                            </div>

                                            <div className="info-row">
                                                <span>Mode</span>
                                                <strong>{selectedGRN.paymentMode}</strong>
                                            </div>

                                            <div className="info-row">
                                                <span>Pending</span>
                                                <strong>₹{modalPending}</strong>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="grn-payment-edit">
                                            <input
                                                type="number"
                                                placeholder="Paid Amount"
                                                value={selectedGRN.paidAmount}
                                                onChange={(e) =>
                                                    setSelectedGRN({
                                                        ...selectedGRN,
                                                        paidAmount: e.target.value,
                                                    })
                                                }
                                            />

                                            <select
                                                value={selectedGRN.paymentMode}
                                                onChange={(e) =>
                                                    setSelectedGRN({
                                                        ...selectedGRN,
                                                        paymentMode: e.target.value,
                                                    })
                                                }
                                            >
                                                <option>Cash</option>
                                                <option>Card</option>
                                                <option>UPI</option>
                                                <option>Credit</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h3 className="grn-section-title">
                                {modalMode === "view" ? "Products Received" : "Edit Products"}
                            </h3>

                            <div className="modal-table">
                                <table className="grn-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Barcode</th>
                                            <th>Qty</th>
                                            <th>Unit</th>
                                            <th>Purchase</th>
                                            <th>Selling</th>
                                            <th>MRP</th>
                                            <th>GST</th>
                                            <th>Total</th>
                                            {modalMode === "edit" && <th>Remove</th>}
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {selectedGRN.products.map((item, index) => (
                                            <tr key={index}>
                                                <td className="product-name-cell">{item.name}</td>
                                                <td>{item.barcode}</td>

                                                <td>
                                                    {modalMode === "edit" ? (
                                                        <div className="grn-qty-control">
                                                            <button
                                                                className="minus-btn"
                                                                onClick={() => decreaseQty(index)}
                                                            >
                                                                -
                                                            </button>
                                                            <span>{item.qty}</span>
                                                            <button
                                                                className="plus-btn"
                                                                onClick={() => increaseQty(index)}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        item.qty
                                                    )}
                                                </td>

                                                <td>
                                                    {modalMode === "edit" ? (
                                                        <select
                                                            value={item.unit}
                                                            onChange={(e) =>
                                                                updateProductField(index, "unit", e.target.value)
                                                            }
                                                        >
                                                            <option>PCS</option>
                                                            <option>Box</option>
                                                            <option>KG</option>
                                                            <option>Litre</option>
                                                        </select>
                                                    ) : (
                                                        item.unit
                                                    )}
                                                </td>

                                                <td>
                                                    {modalMode === "edit" ? (
                                                        <input
                                                            type="number"
                                                            value={item.purchasePrice}
                                                            onChange={(e) =>
                                                                updateProductField(
                                                                    index,
                                                                    "purchasePrice",
                                                                    e.target.value
                                                                )
                                                            }
                                                        />
                                                    ) : (
                                                        `₹${item.purchasePrice}`
                                                    )}
                                                </td>

                                                <td>
                                                    {modalMode === "edit" ? (
                                                        <input
                                                            type="number"
                                                            value={item.sellingPrice}
                                                            onChange={(e) =>
                                                                updateProductField(
                                                                    index,
                                                                    "sellingPrice",
                                                                    e.target.value
                                                                )
                                                            }
                                                        />
                                                    ) : (
                                                        `₹${item.sellingPrice}`
                                                    )}
                                                </td>

                                                <td>
                                                    {modalMode === "edit" ? (
                                                        <input
                                                            type="number"
                                                            value={item.mrp}
                                                            onChange={(e) =>
                                                                updateProductField(index, "mrp", e.target.value)
                                                            }
                                                        />
                                                    ) : (
                                                        `₹${item.mrp}`
                                                    )}
                                                </td>

                                                <td>
                                                    {modalMode === "edit" ? (
                                                        <input
                                                            type="number"
                                                            value={item.gst}
                                                            onChange={(e) =>
                                                                updateProductField(index, "gst", e.target.value)
                                                            }
                                                        />
                                                    ) : (
                                                        `${item.gst}%`
                                                    )}
                                                </td>

                                                <td>₹{item.total}</td>

                                                {modalMode === "edit" && (
                                                    <td>
                                                        <button
                                                            className="remove-btn"
                                                            onClick={() => removeProduct(index)}
                                                        >
                                                            Remove
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="grn-modal-footer">
                            <div className="grn-summary-card">
                                <div>
                                    <span>Subtotal</span>
                                    <strong>₹{totalAmount}</strong>
                                </div>

                                <div>
                                    <span>GST</span>
                                    <strong>₹{gstAmount}</strong>
                                </div>

                                <div>
                                    <span>Grand Total</span>
                                    <strong className="grand-total">₹{grandTotal}</strong>
                                </div>

                                <div>
                                    <span>Pending</span>
                                    <strong>₹{modalPending}</strong>
                                </div>
                            </div>

                            {modalMode === "edit" && (
                                <button className="save-grn-btn" onClick={saveGRNUpdate}>
                                    Save GRN Update
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
