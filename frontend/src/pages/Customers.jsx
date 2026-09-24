import AsyncForm from "../components/AsyncForm";
import AsyncButton from "../components/AsyncButton";
import { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import PhoneInput from "../components/PhoneInput";
const emptyCustomer = {
    name: "",
    contact: "",
    email: "",
    address: "",
};

export default function Customers() {
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [history, setHistory] = useState([]);
    const [form, setForm] = useState(emptyCustomer);
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [activeTab, setActiveTab] = useState("list");
    const [segments, setSegments] = useState({ customers: [], summary: {} });
    const [redeemPoints, setRedeemPoints] = useState("");

    const customersPerPage = 20;

    const fetchSegments = async () => {
        try {
            const res = await API.get("/customers/segments");
            setSegments({ customers: res.data.customers || [], summary: res.data.summary || {} });
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        if (activeTab === "segments") fetchSegments();
    }, [activeTab]);

    const submitRedeem = async () => {
        const points = Number(redeemPoints || 0);
        if (!selectedCustomer || points <= 0) return;
        try {
            const res = await API.patch(`/customers/${selectedCustomer._id}/redeem-points`, { points });
            setSelectedCustomer(res.data.customer);
            setRedeemPoints("");
            alert(`Redeemed ${points} points (₹${res.data.discountValue} value)`);
            fetchCustomers();
        } catch (error) {
            alert(error.response?.data?.message || "Redeem failed");
        }
    };

    const fetchCustomers = async () => {
        const res = await API.get("/customers");
        setCustomers(res.data.customers || []);
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const filteredCustomers = useMemo(() => {
        const q = search.toLowerCase().trim();

        if (!q) return customers;

        return customers.filter(
            (c) =>
                c.name?.toLowerCase().includes(q) ||
                c.crn?.toLowerCase().includes(q) ||
                c.contact?.toLowerCase().includes(q)
        );
    }, [customers, search]);

    const totalPages = Math.ceil(filteredCustomers.length / customersPerPage) || 1;

    const paginatedCustomers = filteredCustomers.slice(
        (currentPage - 1) * customersPerPage,
        currentPage * customersPerPage
    );

    const addCustomer = async (e) => {
        e.preventDefault();

        await API.post("/customers", form);

        setForm(emptyCustomer);
        setShowAdd(false);
        fetchCustomers();
    };

    const openEdit = (customer) => {
        setSelectedCustomer(customer);
        setForm({
            name: customer.name || "",
            contact: customer.contact || "",
            email: customer.email || "",
            address: customer.address || "",
        });
        setShowEdit(true);
    };

    const updateCustomer = async (e) => {
        e.preventDefault();

        await API.put(`/customers/${selectedCustomer._id}`, form);

        setForm(emptyCustomer);
        setSelectedCustomer(null);
        setShowEdit(false);
        fetchCustomers();
    };
    const deleteCustomer = async (password) => {
        if (!deleteTarget) return;
        try {
            await API.delete(`/customers/${deleteTarget._id}`, { data: { password } });

            alert("Customer deleted successfully");
            fetchCustomers();
            setDeleteTarget(null);

            if (showInfo) {
                setShowInfo(false);
            }
        } catch {
            alert("Delete failed");
        }
    };
    const openInfo = async (customer) => {
        setSelectedCustomer(customer);

        const res = await API.get(`/customers/${customer._id}/history`);
        const legacySales = (res.data.sales || []).map((sale) => ({
            ...sale,
            invoiceNo: sale.invoiceNo,
            source: "POS",
            orderType: "Billing",
            status: "Paid",
        }));
        const restaurantOrders = (res.data.restaurantOrders || []).map((order) => ({
            ...order,
            invoiceNo: order.invoiceNo || order.orderNo,
            source: "Restaurant",
        }));
        setHistory([...restaurantOrders, ...legacySales]);

        setShowInfo(true);
    };

    const formatDate = (date) => {
        if (!date) return "N/A";

        return new Date(date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    };

    const getPaymentMode = (payment) => {
        if (!payment) return "N/A";

        if (payment.mode && payment.mode !== "Partial") return payment.mode;

        const modes = [];

        if (Number(payment.cash) > 0) modes.push("Cash");
        if (Number(payment.upi) > 0) modes.push("UPI");
        if (Number(payment.card) > 0) modes.push("Card");
        if (Number(payment.credit) > 0) modes.push("Credit");

        return modes.join(" + ") || "N/A";
    };

    return (
        <div className="customers-page">
            <div className="customers-head">
                <div>
                    <h1>Customer Management</h1>
                    <p>Manage customer profiles, CRN numbers, contact details and purchase history</p>
                </div>
            </div>

            <div className="restaurant-section-tabs">
                <button type="button" className={activeTab === "list" ? "active" : ""} onClick={() => setActiveTab("list")}>Customer List</button>
                <button type="button" className={activeTab === "segments" ? "active" : ""} onClick={() => setActiveTab("segments")}>Segments & Loyalty</button>
            </div>

            {activeTab === "list" && <div className="customer-search-card">
                <input
                    placeholder="Search by Customer Name / Contact / CRN..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setCurrentPage(1);
                    }}
                />

                <button onClick={() => setCurrentPage(1)}>Search</button>

                <button
                    className="add-customer-btn"
                    onClick={() => {
                        setForm(emptyCustomer);
                        setShowAdd(true);
                    }}
                >
                    + Add Customer
                </button>
            </div>}

            {activeTab === "segments" && (
                <div className="customers-table-card">
                    <h2>Customer Segments</h2>
                    <div className="restaurant-stats-grid">
                        {["new", "regular", "frequent", "vip", "inactive"].map((seg) => (
                            <div key={seg}>
                                <span>{seg}</span>
                                <b>{segments.summary[seg] || 0}</b>
                            </div>
                        ))}
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Contact</th>
                                <th>Visits</th>
                                <th>Loyalty Points</th>
                                <th>Last Visit</th>
                                <th>Segment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {segments.customers.length === 0 ? (
                                <tr><td colSpan="6">No customer data</td></tr>
                            ) : (
                                segments.customers.map((c) => (
                                    <tr key={c._id}>
                                        <td>{c.name}</td>
                                        <td>{c.contact}</td>
                                        <td>{c.visits}</td>
                                        <td>{c.loyaltyPoints || 0}</td>
                                        <td>{formatDate(c.lastVisit)}</td>
                                        <td><span className="crn-badge">{c.segment}</span></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === "list" && <div className="customers-table-card">
                <h2>Customer List</h2>

                <table>
                    <thead>
                        <tr>
                            <th>Customer Name</th>
                            <th>CRN</th>
                            <th>Contact</th>
                            <th>Email</th>
                            <th>Address</th>
                            <th>CRN Active From</th>
                            <th>Info</th>
                            <th>Edit</th>
                        </tr>
                    </thead>

                    <tbody>
                        {paginatedCustomers.length === 0 ? (
                            <tr>
                                <td colSpan="8">No customer found</td>
                            </tr>
                        ) : (
                            paginatedCustomers.map((c) => (
                                <tr key={c._id}>
                                    <td>
                                        <b>{c.name}</b>
                                    </td>
                                    <td>
                                        <span className="crn-badge">{c.crn}</span>
                                    </td>
                                    <td>{c.contact}</td>
                                    <td>{c.email || "N/A"}</td>
                                    <td>{c.address || "N/A"}</td>
                                    <td>{formatDate(c.activeFrom)}</td>
                                    <td>
                                        <AsyncButton className="customer-info-btn" onClick={() => openInfo(c)}>
                                            i
                                        </AsyncButton>
                                    </td>
                                    <td>
                                        <button className="customer-edit-btn" onClick={() => openEdit(c)}>
                                            ✎
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                <div className="customer-pagination">
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
            </div>}

            {showAdd && (
                <CustomerModal title="Add Customer" close={() => setShowAdd(false)}>
                    <CustomerForm
                        form={form}
                        setForm={setForm}
                        submit={addCustomer}
                        buttonText="Save Customer"
                    />
                </CustomerModal>
            )}

            {showEdit && (
                <CustomerModal title="Edit Customer" close={() => setShowEdit(false)}>
                    <CustomerForm
                        form={form}
                        setForm={setForm}
                        submit={updateCustomer}
                        buttonText="Update Customer"
                    />
                </CustomerModal>
            )}

            {showInfo && selectedCustomer && (
                <CustomerModal title="Customer Info" close={() => setShowInfo(false)}>
                    <div className="customer-info-box">
                        <div className="customer-info-grid">
                            <Info label="Customer Name" value={selectedCustomer.name} />
                            <Info label="CRN" value={selectedCustomer.crn} />
                            <Info label="Contact" value={selectedCustomer.contact} />
                            <Info label="Email" value={selectedCustomer.email || "N/A"} />
                            <Info label="Address" value={selectedCustomer.address || "N/A"} />
                            <Info
                                label="CRN Active From"
                                value={formatDate(selectedCustomer.activeFrom)}
                            />
                            <Info label="Loyalty Points" value={selectedCustomer.loyaltyPoints || 0} />
                            <Info label="Total Visits" value={selectedCustomer.totalVisits || 0} />
                        </div>
                        <div className="customer-info-actions">
                            <input
                                type="number"
                                min="1"
                                max={selectedCustomer.loyaltyPoints || 0}
                                placeholder="Points to redeem"
                                value={redeemPoints}
                                onChange={(e) => setRedeemPoints(e.target.value)}
                                style={{ maxWidth: 160 }}
                            />
                            <AsyncButton onClick={submitRedeem}>Redeem Points</AsyncButton>
                            <button
                                className="delete-customer-btn"
                                onClick={() => setDeleteTarget(selectedCustomer)}
                            >
                                Delete Customer
                            </button>
                        </div>
                        <h3>Order / Invoice History</h3>

                        <table>
                            <thead>
                                <tr>
                                    <th>Invoice No</th>
                                    <th>Type</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Payment</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {history.length === 0 ? (
                                    <tr>
                                        <td colSpan="6">No order history found</td>
                                    </tr>
                                ) : (
                                    history.map((sale) => (
                                        <tr key={sale._id}>
                                            <td>{sale.invoiceNo}</td>
                                            <td>{sale.orderType || sale.source}</td>
                                            <td>{formatDate(sale.createdAt)}</td>
                                            <td>₹{sale.grandTotal}</td>
                                            <td>{getPaymentMode(sale.payment)}</td>
                                            <td>{sale.status || "Paid"}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CustomerModal>
            )}
            <DeleteConfirmModal
                open={!!deleteTarget}
                title={`Delete ${deleteTarget?.name || "customer"}?`}
                message="Customer record will be deleted. Enter login password to continue."
                onCancel={() => setDeleteTarget(null)}
                onConfirm={deleteCustomer}
            />
        </div>
    );
}

function CustomerModal({ title, close, children }) {
    return (
        <div className="customer-modal-overlay">
            <div className="customer-modal">
                <div className="customer-modal-head">
                    <h2>{title}</h2>
                    <button onClick={close}>×</button>
                </div>

                {children}
            </div>
        </div>
    );
}

function CustomerForm({ form, setForm, submit, buttonText }) {
    return (
        <AsyncForm className="customer-form-grid" onSubmit={submit}>
            <input
                placeholder="Customer Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
            />

            <PhoneInput
                placeholder="Customer contact number"
                value={form.contact}
                onChange={(value) => setForm({ ...form, contact: value })}
                required
            />

            <input
                placeholder="Email ID Optional"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
                placeholder="Address Optional"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
            />

            <div className="auto-field">
                <span>Customer Relationship Number</span>
                <b>Auto Generated: CRN_001</b>
            </div>

            <div className="auto-field">
                <span>CRN Active From</span>
                <b>Auto Generated Today</b>
            </div>

            <button>{buttonText}</button>
        </AsyncForm>
    );
}

function Info({ label, value }) {
    return (
        <div>
            <span>{label}</span>
            <b>{value}</b>
        </div>
    );
}
