import AsyncForm from "../components/AsyncForm";
import AsyncButton from "../components/AsyncButton";
import { useEffect, useState } from "react";
import API from "../api/axios";
import PhoneInput from "../components/PhoneInput";
import { X } from "lucide-react";
export default function Purchase() {
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);

  const [vendorSearch, setVendorSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [showVendorPopup, setShowVendorPopup] = useState(false);
  const [showProductPopup, setShowProductPopup] = useState(false);

  const [selectedGRN, setSelectedGRN] = useState(null);
  const [grnPaymentEdit, setGrnPaymentEdit] = useState({
    paidAmount: "",
    paymentMode: "Credit",
  });

  const [invoiceNo, setInvoiceNo] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Credit");

  const [qty, setQty] = useState(1);
  const [items, setItems] = useState([]);

  const [vendorForm, setVendorForm] = useState({
    name: "",
    phone: "",
    email: "",
    gstNumber: "",
    address: "",
    openingBalance: "",
  });

  const [grnProductEdit, setGrnProductEdit] = useState({
    purchasePrice: "",
    sellingPrice: "",
    mrp: "",
    gst: "",
    unit: "PCS",
  });

  const [productForm, setProductForm] = useState({
    name: "",
    barcode: "",
    sku: "",
    category: "",
    unit: "PCS",
    purchasePrice: "",
    sellingPrice: "",
    mrp: "",
    gst: "",
    openingStock: 0,
    lowStockLimit: 5,
    expiryDate: "",
  });

  const fetchAll = async () => {
    try {
      const vendorRes = await API.get("/vendors");
      const productRes = await API.get("/products");
      const purchaseRes = await API.get("/purchases");

      setVendors(vendorRes.data.vendors || []);
      setProducts(productRes.data.products || []);
      setPurchases(purchaseRes.data.purchases || []);
    } catch (error) {
      console.log("Fetch error:", error.response?.data || error.message);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredVendors = vendors.filter((v) =>
    v.name?.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    );
  });

  const selectVendor = (vendor) => {
    setSelectedVendor(vendor);
    setVendorSearch(vendor.name);
    setProductSearch("");
    setSelectedProduct(null);
  };

  const clearVendor = () => {
    setSelectedVendor(null);
    setVendorSearch("");
    setProductSearch("");
    setSelectedProduct(null);
    setItems([]);
  };

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setProductSearch(`${product.name} - ${product.barcode}`);
    setQty(1);

    setGrnProductEdit({
      purchasePrice: product.purchasePrice || "",
      sellingPrice: product.sellingPrice || "",
      mrp: product.mrp || "",
      gst: product.gst || "",
      unit: product.unit || "PCS",
    });
  };

  const createVendor = async (e) => {
    e.preventDefault();

    try {
      const res = await API.post("/vendors", {
        ...vendorForm,
        openingBalance: Number(vendorForm.openingBalance || 0),
      });
      const vendor = res.data.vendor;

      setSelectedVendor(vendor);
      setVendorSearch(vendor.name);
      setShowVendorPopup(false);

      setVendorForm({
        name: "",
        phone: "",
        email: "",
        gstNumber: "",
        address: "",
        openingBalance: "",
      });

      fetchAll();
    } catch (error) {
      alert(error.response?.data?.message || "Vendor create failed");
    }
  };

  const createProduct = async (e) => {
    e.preventDefault();

    if (!selectedVendor) {
      alert("Please select a vendor first");
      return;
    }

    try {
      const res = await API.post("/products", {
        ...productForm,
        vendorId: selectedVendor._id,
        vendorName: selectedVendor.name,
      });

      const product = res.data.product;

      setSelectedProduct(product);
      setProductSearch(`${product.name} - ${product.barcode}`);
      setGrnProductEdit({
        purchasePrice: product.purchasePrice || "",
        sellingPrice: product.sellingPrice || "",
        mrp: product.mrp || "",
        gst: product.gst || "",
        unit: product.unit || "PCS",
      });

      setShowProductPopup(false);

      setProductForm({
        name: "",
        barcode: "",
        sku: "",
        category: "",
        unit: "PCS",
        purchasePrice: "",
        sellingPrice: "",
        mrp: "",
        gst: "",
        openingStock: 0,
        lowStockLimit: 5,
        expiryDate: "",
      });

      fetchAll();
    } catch (error) {
      alert(error.response?.data?.message || "Product create failed");
    }
  };

  const increaseQty = () => {
    setQty((prev) => Number(prev) + 1);
  };

  const decreaseQty = () => {
    setQty((prev) => (Number(prev) > 1 ? Number(prev) - 1 : 1));
  };

  const addProductToGRN = () => {
    if (!selectedVendor) {
      alert("Please select a vendor");
      return;
    }

    if (!selectedProduct) {
      alert("Please select a product");
      return;
    }

    const purchasePrice = Number(grnProductEdit.purchasePrice || 0);
    const sellingPrice = Number(grnProductEdit.sellingPrice || 0);
    const mrp = Number(grnProductEdit.mrp || 0);
    const gst = Number(grnProductEdit.gst || 0);
    const unit = grnProductEdit.unit || "PCS";

    if (!purchasePrice || !sellingPrice) {
      alert("Purchase price and selling price are required");
      return;
    }

    const exists = items.find((i) => i.productId === selectedProduct._id);

    if (exists) {
      setItems(
        items.map((i) =>
          i.productId === selectedProduct._id
            ? {
              ...i,
              qty: Number(i.qty) + Number(qty),
              purchasePrice,
              sellingPrice,
              mrp,
              gst,
              unit,
              total: purchasePrice * (Number(i.qty) + Number(qty)),
            }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          productId: selectedProduct._id,
          name: selectedProduct.name,
          barcode: selectedProduct.barcode,
          unit,
          qty: Number(qty),
          purchasePrice,
          sellingPrice,
          mrp,
          gst,
          total: purchasePrice * Number(qty),
        },
      ]);
    }

    setSelectedProduct(null);
    setProductSearch("");
    setQty(1);
    setGrnProductEdit({
      purchasePrice: "",
      sellingPrice: "",
      mrp: "",
      gst: "",
      unit: "PCS",
    });
  };

  const updateItemQty = (index, type) => {
    const updated = [...items];

    if (type === "plus") {
      updated[index].qty = Number(updated[index].qty) + 1;
    } else {
      updated[index].qty =
        Number(updated[index].qty) > 1 ? Number(updated[index].qty) - 1 : 1;
    }

    updated[index].total =
      Number(updated[index].purchasePrice) * Number(updated[index].qty);

    setItems(updated);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce(
    (sum, item) => sum + Number(item.purchasePrice) * Number(item.qty),
    0
  );

  const gstAmount = items.reduce((sum, item) => {
    const base = Number(item.purchasePrice) * Number(item.qty);
    return sum + (base * Number(item.gst || 0)) / 100;
  }, 0);

  const grandTotal = totalAmount + gstAmount;
  const pendingAmount = Math.max(grandTotal - Number(paidAmount || 0), 0);

  const saveGRN = async () => {
    if (!selectedVendor) {
      alert("Vendor required");
      return;
    }

    if (!invoiceNo) {
      alert("Invoice number required");
      return;
    }

    if (items.length === 0) {
      alert("Add at least one product");
      return;
    }

    try {
      const res = await API.post("/purchases", {
        vendorId: selectedVendor._id,
        vendorName: selectedVendor.name,
        invoiceNo,
        products: items,
        paidAmount,
        paymentMode,
        createdBy: JSON.parse(localStorage.getItem("user"))?.name || "Admin",
      });

      const priceChanges = res.data.priceChanges || [];
      if (priceChanges.length > 0) {
        const summary = priceChanges
          .map((c) => `${c.name}: ₹${c.previousPrice} -> ₹${c.newPrice} (${c.changePercent > 0 ? "+" : ""}${c.changePercent}%)`)
          .join("\n");
        alert(`GRN saved. Price change detected:\n${summary}`);
      } else {
        alert("GRN saved successfully. Stock has been updated.");
      }

      setItems([]);
      setInvoiceNo("");
      setPaidAmount("");
      setPaymentMode("Credit");
      setSelectedVendor(null);
      setVendorSearch("");
      setProductSearch("");
      setSelectedProduct(null);
      fetchAll();
    } catch (error) {
      alert(error.response?.data?.message || "GRN save failed");
    }
  };

  const viewGRN = async (id) => {
    try {
      const res = await API.get(`/purchases/${id}`);

      setSelectedGRN(res.data.purchase);

      setGrnPaymentEdit({
        paidAmount: res.data.purchase.paidAmount || 0,
        paymentMode: res.data.purchase.paymentMode || "Credit",
      });
    } catch (error) {
      alert(error.response?.data?.message || "GRN details fetch failed");
    }
  };

  const updateGRNPayment = async () => {
    if (!selectedGRN) return;

    try {
      const res = await API.put(`/purchases/${selectedGRN._id}/payment`, {
        paidAmount: grnPaymentEdit.paidAmount,
        paymentMode: grnPaymentEdit.paymentMode,
      });

      alert("GRN payment updated");

      setSelectedGRN(res.data.purchase);
      fetchAll();
    } catch (error) {
      alert(error.response?.data?.message || "Payment update failed");
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Purchase / GRN Entry</h1>
          <p>Receive vendor stock, create purchase bills and update product cost, GST and payments</p>
        </div>
      </div>

      <div className="grn-layout">
        <div className="panel">
          <h2>Select Vendor</h2>

          <div className="search-line">
            <input
              placeholder="Search Vendor Name"
              value={vendorSearch}
              onChange={(e) => {
                setVendorSearch(e.target.value);
                setSelectedVendor(null);
              }}
            />

            <button type="button" onClick={() => setShowVendorPopup(true)}>
              + New Vendor
            </button>
          </div>

          {vendorSearch && !selectedVendor && (
            <div className="search-dropdown-static">
              {filteredVendors.length > 0 ? (
                filteredVendors.map((vendor) => (
                  <div key={vendor._id} onClick={() => selectVendor(vendor)}>
                    <b>{vendor.name}</b>
                    <span>
                      GST: {vendor.gstNumber || "N/A"} | Phone:{" "}
                      {vendor.phone || "N/A"}
                    </span>
                  </div>
                ))
              ) : (
                <div>
                  <b>No vendor found</b>
                  <span>Create new vendor</span>
                  <button
                    type="button"
                    onClick={() => setShowVendorPopup(true)}
                  >
                    Create Vendor
                  </button>
                </div>
              )}
            </div>
          )}

          {selectedVendor && (
            <div className="selected-box">
              <h3>Selected Vendor</h3>
              <p>Name: {selectedVendor.name}</p>
              <p>GST: {selectedVendor.gstNumber || "N/A"}</p>
              <p>Phone: {selectedVendor.phone || "N/A"}</p>
              <p>Pending: ₹{selectedVendor.pendingAmount || 0}</p>

              <button type="button" onClick={clearVendor}>
                Change Vendor
              </button>
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Purchase Details</h2>

          <div className="form-grid">
            <input
              placeholder="Vendor Invoice Number"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />

            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option>Cash</option>
              <option>Card</option>
              <option>UPI</option>
              <option>Credit</option>
            </select>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Search Product by Barcode / Name / SKU</h2>

        <div className="search-line">
          <input
            disabled={!selectedVendor}
            placeholder={
              selectedVendor
                ? "Scan Barcode / Search Product Name / SKU"
                : "Please select a vendor first"
            }
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value);
              setSelectedProduct(null);
            }}
          />

          <button
            type="button"
            disabled={!selectedVendor}
            onClick={() => setShowProductPopup(true)}
          >
            + New Product
          </button>
        </div>

        {productSearch && !selectedProduct && (
          <div className="search-dropdown-static">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <div key={product._id} onClick={() => selectProduct(product)}>
                  <b>{product.name}</b>
                  <span>
                    Barcode: {product.barcode} | Stock: {product.stock} | Buy:
                    ₹{product.purchasePrice} | Sale: ₹{product.sellingPrice}
                  </span>
                </div>
              ))
            ) : (
              <div>
                <b>No product found</b>
                <span>Create new product</span>
                <button
                  type="button"
                  onClick={() => setShowProductPopup(true)}
                >
                  Create Product
                </button>
              </div>
            )}
          </div>
        )}

        {selectedProduct && (
          <div className="selected-product-grn editable-product-card">
            <div>
              <h3>{selectedProduct.name}</h3>
              <p>Barcode: {selectedProduct.barcode}</p>
              <p>Current Stock: {selectedProduct.stock}</p>
            </div>

            <div className="grn-edit-grid">
              <input
                type="number"
                placeholder="Purchase Price"
                value={grnProductEdit.purchasePrice}
                onChange={(e) =>
                  setGrnProductEdit({
                    ...grnProductEdit,
                    purchasePrice: e.target.value,
                  })
                }
              />

              <input
                type="number"
                placeholder="Selling Price"
                value={grnProductEdit.sellingPrice}
                onChange={(e) =>
                  setGrnProductEdit({
                    ...grnProductEdit,
                    sellingPrice: e.target.value,
                  })
                }
              />

              <input
                type="number"
                placeholder="MRP"
                value={grnProductEdit.mrp}
                onChange={(e) =>
                  setGrnProductEdit({
                    ...grnProductEdit,
                    mrp: e.target.value,
                  })
                }
              />

              <input
                type="number"
                placeholder="GST %"
                value={grnProductEdit.gst}
                onChange={(e) =>
                  setGrnProductEdit({
                    ...grnProductEdit,
                    gst: e.target.value,
                  })
                }
              />

              <select
                value={grnProductEdit.unit}
                onChange={(e) =>
                  setGrnProductEdit({
                    ...grnProductEdit,
                    unit: e.target.value,
                  })
                }
              >
                <option>PCS</option>
                <option>Box</option>
                <option>KG</option>
                <option>Litre</option>
              </select>
            </div>

            <div className="qty-box">
              <button type="button" onClick={decreaseQty}>
                -
              </button>
              <input value={qty} readOnly />
              <button type="button" onClick={increaseQty}>
                +
              </button>
            </div>

            <button type="button" onClick={addProductToGRN}>
              Add To GRN
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>GRN Product List</h2>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Barcode</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Purchase</th>
              <th>GST</th>
              <th>Total</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="8">No product added</td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={index}>
                  <td>{item.name}</td>
                  <td>{item.barcode}</td>
                  <td>
                    <div className="table-qty">
                      <button onClick={() => updateItemQty(index, "minus")}>
                        -
                      </button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateItemQty(index, "plus")}>
                        +
                      </button>
                    </div>
                  </td>
                  <td>{item.unit}</td>
                  <td>₹{item.purchasePrice}</td>
                  <td>{item.gst}%</td>
                  <td>₹{item.total}</td>
                  <td>
                    <button onClick={() => removeItem(index)}>Remove</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="two-grid">
        <div className="panel">
          <h2>GRN Summary</h2>
          <p>Subtotal: ₹{totalAmount}</p>
          <p>GST Amount: ₹{gstAmount}</p>
          <h2>Grand Total: ₹{grandTotal}</h2>

          <input
            type="number"
            placeholder="Paid Amount"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
          />

          <p>Pending Amount: ₹{pendingAmount}</p>

          <AsyncButton onClick={saveGRN}>Save GRN & Increase Stock</AsyncButton>
        </div>

        <div className="panel">
          <h2>Recent GRN / Purchases</h2>

          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Vendor</th>
                <th>Total</th>
                <th>Pending</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {purchases.slice(0, 6).map((p) => (
                <tr key={p._id}>
                  <td>{p.invoiceNo}</td>
                  <td>{p.vendorName}</td>
                  <td>₹{p.grandTotal}</td>
                  <td>₹{p.pendingAmount}</td>
                  <td>
                    <AsyncButton onClick={() => viewGRN(p._id)}>View</AsyncButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showVendorPopup && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <h2>Create Vendor</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" title="Close" onClick={() => setShowVendorPopup(false)}><X size={20} strokeWidth={2.5} /></button>
            </div>

            <AsyncForm className="form-grid" onSubmit={createVendor}>
              <input
                placeholder="Vendor Name"
                value={vendorForm.name}
                onChange={(e) =>
                  setVendorForm({ ...vendorForm, name: e.target.value })
                }
                required
              />

              <PhoneInput
                placeholder="Mobile number"
                value={vendorForm.phone}
                onChange={(value) => setVendorForm({ ...vendorForm, phone: value })}
              />

              <input
                placeholder="Email"
                value={vendorForm.email}
                onChange={(e) =>
                  setVendorForm({ ...vendorForm, email: e.target.value })
                }
              />

              <input
                placeholder="GST Number"
                value={vendorForm.gstNumber}
                onChange={(e) =>
                  setVendorForm({ ...vendorForm, gstNumber: e.target.value })
                }
              />

              <input
                placeholder="Address"
                value={vendorForm.address}
                onChange={(e) =>
                  setVendorForm({ ...vendorForm, address: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="Opening Balance"
                value={vendorForm.openingBalance}
                onChange={(e) =>
                  setVendorForm({
                    ...vendorForm,
                    openingBalance: e.target.value,
                  })
                }
              />

              <button>Create Vendor</button>
            </AsyncForm>
          </div>
        </div>
      )}

      {showProductPopup && (
        <div className="modal-overlay">
          <div className="modal-card large">
            <div className="modal-head">
              <h2>Create Product</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" title="Close" onClick={() => setShowProductPopup(false)}><X size={20} strokeWidth={2.5} /></button>
            </div>

            <AsyncForm className="form-grid" onSubmit={createProduct}>
              <input
                placeholder="Product Name"
                value={productForm.name}
                onChange={(e) =>
                  setProductForm({ ...productForm, name: e.target.value })
                }
                required
              />

              <input
                placeholder="Barcode"
                value={productForm.barcode}
                onChange={(e) =>
                  setProductForm({ ...productForm, barcode: e.target.value })
                }
                required
              />

              <input
                placeholder="SKU"
                value={productForm.sku}
                onChange={(e) =>
                  setProductForm({ ...productForm, sku: e.target.value })
                }
              />

              <input
                placeholder="Category"
                value={productForm.category}
                onChange={(e) =>
                  setProductForm({ ...productForm, category: e.target.value })
                }
              />

              <select
                value={productForm.unit}
                onChange={(e) =>
                  setProductForm({ ...productForm, unit: e.target.value })
                }
              >
                <option>PCS</option>
                <option>Box</option>
                <option>KG</option>
                <option>Litre</option>
              </select>

              <input
                type="number"
                placeholder="Purchase Price"
                value={productForm.purchasePrice}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    purchasePrice: e.target.value,
                  })
                }
                required
              />

              <input
                type="number"
                placeholder="Selling Price"
                value={productForm.sellingPrice}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    sellingPrice: e.target.value,
                  })
                }
                required
              />

              <input
                type="number"
                placeholder="MRP"
                value={productForm.mrp}
                onChange={(e) =>
                  setProductForm({ ...productForm, mrp: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="GST %"
                value={productForm.gst}
                onChange={(e) =>
                  setProductForm({ ...productForm, gst: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="Low Stock Limit"
                value={productForm.lowStockLimit}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    lowStockLimit: e.target.value,
                  })
                }
              />

              <input
                type="date"
                value={productForm.expiryDate}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    expiryDate: e.target.value,
                  })
                }
              />

              <button>Create Product</button>
            </AsyncForm>
          </div>
        </div>
      )}

      {selectedGRN && (
        <div className="modal-overlay">
          <div className="modal-card large">
            <div className="modal-head">
              <h2>GRN Details</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" title="Close" onClick={() => setSelectedGRN(null)}><X size={20} strokeWidth={2.5} /></button>
            </div>

            <div className="grn-detail-grid">
              <div>
                <h3>Vendor Details</h3>
                <p>Vendor: {selectedGRN.vendorName}</p>
                <p>Invoice No: {selectedGRN.invoiceNo}</p>
                <p>
                  Date: {new Date(selectedGRN.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div>
                <h3>Payment Summary</h3>
                <p>Total: ₹{selectedGRN.grandTotal}</p>
                <p>Paid: ₹{selectedGRN.paidAmount}</p>
                <p>Pending: ₹{selectedGRN.pendingAmount}</p>
                <p>Mode: {selectedGRN.paymentMode}</p>
              </div>
            </div>

            <h3>Products Received</h3>

            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Qty</th>
                  <th>Purchase</th>
                  <th>Selling</th>
                  <th>MRP</th>
                  <th>GST</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {selectedGRN.products.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.barcode}</td>
                    <td>
                      {item.qty} {item.unit}
                    </td>
                    <td>₹{item.purchasePrice}</td>
                    <td>₹{item.sellingPrice}</td>
                    <td>₹{item.mrp}</td>
                    <td>{item.gst}%</td>
                    <td>₹{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="panel inner-panel">
              <h3>Update Vendor Payment</h3>

              <div className="form-grid">
                <input
                  type="number"
                  placeholder="Paid Amount"
                  value={grnPaymentEdit.paidAmount}
                  onChange={(e) =>
                    setGrnPaymentEdit({
                      ...grnPaymentEdit,
                      paidAmount: e.target.value,
                    })
                  }
                />

                <select
                  value={grnPaymentEdit.paymentMode}
                  onChange={(e) =>
                    setGrnPaymentEdit({
                      ...grnPaymentEdit,
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

              <AsyncButton onClick={updateGRNPayment}>Update Payment</AsyncButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
