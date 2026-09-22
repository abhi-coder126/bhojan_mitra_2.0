import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, RotateCcw } from "lucide-react";
import API from "../api/axios";
import PhoneInput from "../components/PhoneInput";

const CODE128_PATTERNS = [
  "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
  "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
  "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
  "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
  "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
  "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
  "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
  "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
  "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
  "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
  "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
  "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
  "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
  "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
  "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
  "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
  "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
  "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
  "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
  "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
  "11010011100", "1100011101011",
];

const encodeCode128B = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";

  const codes = [104];
  let checksum = 104;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index) - 32;
    if (code < 0 || code > 95) continue;
    codes.push(code);
    checksum += code * (index + 1);
  }

  codes.push(checksum % 103, 106);
  return codes.map((code) => CODE128_PATTERNS[code]).join("");
};

function InvoiceBarcode({ value }) {
  const pattern = encodeCode128B(value);
  const barWidth = 2;
  const height = 74;

  return (
    <div className="invoice-barcode" aria-label={`Invoice barcode ${value}`}>
      <svg
        width={pattern.length * barWidth + 24}
        height={height}
        viewBox={`0 0 ${pattern.length * barWidth + 24} ${height}`}
        role="img"
      >
        <rect width="100%" height="100%" fill="#ffffff" />
        {pattern.split("").map((bit, index) => {
          if (bit !== "1") return null;

          return (
            <rect
              key={index}
              x={12 + index * barWidth}
              y="0"
              width={barWidth}
              height={height}
              fill="#020617"
            />
          );
        })}
      </svg>
      <strong>{value}</strong>
    </div>
  );
}

function InvoiceContent({ invoice, settings }) {
  const paymentMode =
    Object.entries(invoice.payment || {})
      .filter(([, amount]) => Number(amount) > 0)
      .map(([mode]) => mode.toUpperCase())
      .join(" + ") || "N/A";

  const invoiceDate = invoice?.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    : "N/A";

  const invoiceTime = invoice?.createdAt
    ? new Date(invoice.createdAt).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    : "N/A";

  return (
    <div className="invoice-print-area">
      <div className="invoice-title-strip">
        <span>Original For Recipient</span>
        <h2>Tax Invoice</h2>
        <span>Invoice No: {invoice.invoiceNo}</span>
      </div>

      <div className="invoice-header">
        <div className="invoice-store-block">
          <h1>{settings?.storeName || "BhojanMitra"}</h1>
          {(settings?.showStoreDetails ?? true) && (
            <>
              <p>{settings?.storeAddress || "Inventory & Billing Management"}</p>
              {settings?.storeContact && <p>Phone: {settings.storeContact}</p>}
              {settings?.storeEmail && <p>Email: {settings.storeEmail}</p>}
            </>
          )}
          {(settings?.showGSTDetails ?? true) && settings?.gstNumber && (
            <p>GSTIN: {settings.gstNumber}</p>
          )}
        </div>

        <div className="invoice-barcode-card">
          <InvoiceBarcode value={invoice.invoiceNo} />
          <p>Scan barcode to read invoice number</p>
        </div>
      </div>

      <div className="invoice-meta-grid">
        <div>
          <span>Invoice Date</span>
          <b>{invoiceDate}</b>
        </div>
        <div>
          <span>Invoice Time</span>
          <b>{invoiceTime}</b>
        </div>
        <div>
          <span>Payment Mode</span>
          <b>{paymentMode}</b>
        </div>
        <div>
          <span>Invoice Amount</span>
          <b>Rs {Number(invoice.grandTotal || 0).toFixed(2)}</b>
        </div>
      </div>

      <div className="invoice-info">
        <div>
          <h3>Bill To</h3>
          {(settings?.showCustomerDetails ?? true) ? (
            <>
              <p>Name: {invoice.customerName || "Walk-in Customer"}</p>
              <p>Phone: {invoice.customerPhone || "N/A"}</p>
              <p>Address: {invoice.customerAddress || "N/A"}</p>
              {invoice.customerGST && <p>GSTIN: {invoice.customerGST}</p>}
            </>
          ) : (
            <p>Customer details hidden as per invoice settings.</p>
          )}
        </div>

        <div>
          <h3>Invoice Details</h3>
          <p>Invoice No: {invoice.invoiceNo}</p>
          <p>Generated: {invoiceDate}, {invoiceTime}</p>
          <p>Place of Supply: {settings?.storeAddress || "N/A"}</p>
          <p>Status: Paid / Generated</p>
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>Barcode</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>GST</th>
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          {invoice.products?.map((p, index) => (
            <tr key={`${p.barcode || p.name}-${index}`}>
              <td>{index + 1}</td>
              <td>{p.name}</td>
              <td>{p.barcode}</td>
              <td>{p.qty}</td>
              <td>Rs {Number(p.rate || 0).toFixed(2)}</td>
              <td>{p.gst}%</td>
              <td>Rs {Number(p.total || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-summary-row">
        <div className="invoice-policy-box">
          {(settings?.showTerms ?? true) && (
            <div>
              <h3>Terms & Conditions</h3>
              <p>
                {settings?.termsAndConditions ||
                  "Goods once sold will be accepted for return or exchange only as per store policy and with the original invoice."}
              </p>
            </div>
          )}
          {(settings?.showReturnPolicy ?? true) && (
            <div>
              <h3>Return Policy</h3>
              <p>
                {settings?.returnPolicy ||
                  "Returns are subject to product condition, returnable quantity and store approval."}
              </p>
            </div>
          )}
          <div>
            <h3>Privacy Policy</h3>
            <p>
              Customer details printed on this invoice are used only for billing,
              service, warranty and statutory record purposes.
            </p>
          </div>
        </div>

        <div className="invoice-total">
          <p><span>Subtotal</span><b>Rs {Number(invoice.subTotal || 0).toFixed(2)}</b></p>
          <p><span>GST</span><b>Rs {Number(invoice.gstAmount || 0).toFixed(2)}</b></p>
          <p><span>Product Discount</span><b>Rs {Number(invoice.discount || 0).toFixed(2)}</b></p>
          <p><span>Bill Discount</span><b>Rs {Number(invoice.billDiscount || 0).toFixed(2)}</b></p>
          <p><span>Coupon Discount</span><b>Rs {Number(invoice.couponDiscount || 0).toFixed(2)}</b></p>
          <p><span>Total Discount</span><b>Rs {Number(invoice.totalDiscount || 0).toFixed(2)}</b></p>
          <h2>
            <span>Grand Total</span>
            <b>Rs {Number(invoice.grandTotal || 0).toFixed(2)}</b>
          </h2>
        </div>
      </div>

      <div className="invoice-footer">
        {(settings?.showThankYou ?? true) && (
          <p>{settings?.thankYouMessage || "Thank you for shopping with us."}</p>
        )}
        <div>
          <span>Authorized Signatory</span>
          <b>{settings?.storeName || "BhojanMitra"}</b>
        </div>
        <small>This is a computer generated invoice. Powered by BhojanMitra.</small>
      </div>
    </div>
  );
}

export default function BillingPOS() {
  const navigate = useNavigate();

  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (message, type = "error") => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    setToast({ message, type });

    toastTimer.current = setTimeout(() => {
      setToast(null);
    }, 2500);
  };


  const [settings, setSettings] = useState(null);

  const [billDiscountType, setBillDiscountType] = useState("Amount");
  const [billDiscountValue, setBillDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);

  const [lastInvoice, setLastInvoice] = useState(null);
  const [showLastInvoice, setShowLastInvoice] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showPartial, setShowPartial] = useState(false);
  const [selectedMode, setSelectedMode] = useState("");

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState([]);

  const [returnInvoiceNo, setReturnInvoiceNo] = useState("");
  const [returnSale, setReturnSale] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState([]);

  const [partialPayment, setPartialPayment] = useState({
    cash: 0,
    upi: 0,
    card: 0,
  });

  const [customer, setCustomer] = useState({
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerEmail: "",
    customerGST: "",
    customerRelationNo: "",
  });

  const fetchLatestInvoice = async () => {
    try {
      const res = await API.get("/sales/latest");
      setLastInvoice(res.data.sale || null);
    } catch (error) {
      console.log("Latest invoice fetch error:", error);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await API.get("/settings");
      setSettings(res.data.settings || null);
    } catch (error) {
      console.log("Settings fetch error:", error);
    }
  };

  useEffect(() => {
    fetchLatestInvoice();
    fetchSettings();

    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const searchProduct = async (value) => {
    setKeyword(value);

    if (!value.trim()) {
      setResults([]);
      return;
    }

    try {
      const res = await API.get(`/products/search?keyword=${value}`);
      setResults(res.data.products || []);
    } catch (error) {
      setResults([]);
      showToast(error.response?.data?.message || "Product search failed", "warning");
    }
  };

  const addProduct = (product) => {
    if (!product || Number(product.stock) <= 0) {
      return showToast("Out of stock", "warning");
    }

    const exist = cart.find((x) => x.productId === product._id);

    if (exist) {
      if (Number(exist.qty) >= Number(exist.stock)) {
        return showToast("Quantity cannot exceed available stock", "warning");
      }

      setCart(
        cart.map((x) =>
          x.productId === product._id ? { ...x, qty: Number(x.qty) + 1 } : x
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product._id,
          name: product.name,
          barcode: product.barcode,
          qty: 1,
          unit: product.unit,
          mrp: Number(product.mrp || 0),
          rate: Number(product.sellingPrice || 0),
          gst: Number(product.gst || 0),
          discount: 0,
          stock: Number(product.stock || 0),
        },
      ]);
    }

    if (couponDiscount > 0) {
      setCouponDiscount(0);
      setCouponCode("");
      showToast("Coupon removed because the cart changed", "warning");
    }

    setKeyword("");
    setResults([]);
  };

  const handleSearchKey = (e) => {
    if (e.key === "Enter" && results.length > 0) {
      addProduct(results[0]);
    }
  };

  const searchCustomer = async (value) => {
    setCustomerSearch(value);

    setCustomer((prev) => ({
      ...prev,
      customerRelationNo: value,
    }));

    if (!value.trim()) {
      setCustomerResults([]);
      return;
    }

    try {
      const res = await API.get(`/customers/search/customer?keyword=${value}`);
      setCustomerResults(res.data.customers || []);
    } catch (error) {
      setCustomerResults([]);
      showToast(error.response?.data?.message || "Customer search failed", "warning");
    }
  };
  const selectCustomer = (c) => {
    setCustomer({
      customerRelationNo: c.crn || "",
      customerName: c.name || "",
      customerPhone: c.contact || "",
      customerAddress: c.address || "",
      customerEmail: c.email || "",
      customerGST: "",
    });

    setCustomerSearch(`${c.crn} - ${c.name}`);
    setCustomerResults([]);
  };

  const updateCart = (index, field, value) => {
    const updated = [...cart];
    const row = updated[index];

    if (field === "qty") {
      if (Number(value) > Number(row.stock)) {
        return showToast("Quantity cannot exceed available stock", "warning");
      }
      if (Number(value) < 1) {
        return showToast("Quantity must be at least 1", "warning");
      }
    }

    if (field === "discount") {
      const lineAmount = Number(row.rate || 0) * Number(row.qty || 0);
      const discount = Number(value || 0);
      if (discount < 0 || discount > lineAmount) {
        return showToast(`Discount must be between 0 and Rs ${lineAmount.toFixed(2)}`, "warning");
      }
    }

    updated[index] = { ...row, [field]: value };
    setCart(updated);

    if (couponDiscount > 0) {
      setCouponDiscount(0);
      setCouponCode("");
      showToast("Coupon removed because the cart changed", "warning");
    }
  };

  const remove = (index) => {
    setCart(cart.filter((_, i) => i !== index));

    if (couponDiscount > 0) {
      setCouponDiscount(0);
      setCouponCode("");
      showToast("Coupon removed because the cart changed", "warning");
    }
  };

  const totalQty = cart.reduce((s, i) => s + Number(i.qty), 0);

  const subTotal = cart.reduce(
    (s, i) => s + Number(i.rate) * Number(i.qty),
    0
  );

  const productDiscount = cart.reduce(
    (s, i) => s + Number(i.discount || 0),
    0
  );

  let billDiscountAmount = 0;

  if (billDiscountType === "Amount") {
    billDiscountAmount = Number(billDiscountValue || 0);
  }

  if (billDiscountType === "Percent") {
    billDiscountAmount = (subTotal * Number(billDiscountValue || 0)) / 100;
  }

  const gstAmount = cart.reduce((s, i) => {
    const amount = Number(i.rate) * Number(i.qty) - Number(i.discount || 0);
    return s + (amount * Number(i.gst || 0)) / 100;
  }, 0);

  const totalDiscount =
    productDiscount + billDiscountAmount + Number(couponDiscount || 0);

  const grandTotal = Math.max(subTotal + gstAmount - totalDiscount, 0);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return showToast("Coupon code required", "warning");

    try {
      const res = await API.post("/coupons/apply", {
        code: couponCode,
        billAmount: subTotal,
      });

      setCouponDiscount(Number(res.data.discountAmount || 0));
      showToast("Coupon Applied", "success");
    } catch (error) {
      setCouponDiscount(0);
     showToast(error.response?.data?.message || "Coupon apply failed");
    }
  };

  const openPayment = (mode) => {
    if (cart.length === 0) return showToast("Cart Empty", "warning");

    if ((billDiscountAmount > 0 || couponDiscount > 0) && !discountReason.trim()) {
      return showToast("Discount reason required", "warning");
    }

    setSelectedMode(mode);

    if (mode === "Partial") {
      setShowPartial(true);
    } else {
      setShowCustomer(true);
    }
  };

  const submitPartial = () => {
    const paid =
      Number(partialPayment.cash || 0) +
      Number(partialPayment.upi || 0) +
      Number(partialPayment.card || 0);

    if (paid <= 0) return showToast("Partial payment amount required", "warning");

    setShowPartial(false);
    setShowCustomer(true);
  };

  const punchBill = async () => {
    if (
      !customer.customerName ||
      !customer.customerPhone ||
      !customer.customerAddress
    ) {
      return showToast("Customer name, phone and address required", "warning");
    }

    if ((billDiscountAmount > 0 || couponDiscount > 0) && !discountReason.trim()) {
      return showToast("Discount reason required", "warning");
    }

    let payment = { cash: 0, card: 0, upi: 0, credit: 0 };

    if (selectedMode === "Cash") payment.cash = grandTotal;
    if (selectedMode === "Card") payment.card = grandTotal;
    if (selectedMode === "UPI") payment.upi = grandTotal;

    if (selectedMode === "Partial") {
      payment.cash = Number(partialPayment.cash || 0);
      payment.card = Number(partialPayment.card || 0);
      payment.upi = Number(partialPayment.upi || 0);
      payment.credit = Math.max(
        grandTotal - (payment.cash + payment.card + payment.upi),
        0
      );
    }

    const saleProducts = cart.map((i) => {
      const line = Number(i.rate) * Number(i.qty);
      const itemDiscount = Number(i.discount || 0);
      const itemGst = ((line - itemDiscount) * Number(i.gst || 0)) / 100;

      return {
        productId: i.productId,
        name: i.name,
        barcode: i.barcode,
        qty: Number(i.qty),
        unit: i.unit,
        mrp: Number(i.mrp || 0),
        rate: Number(i.rate || 0),
        gst: Number(i.gst || 0),
        discount: itemDiscount,
        total: line - itemDiscount + itemGst,
      };
    });

    try {
      const res = await API.post("/sales", {
        customerName: customer.customerName,
        customerPhone: customer.customerPhone,
        customerAddress: customer.customerAddress,
        customerEmail: customer.customerEmail,
        customerGST: customer.customerGST,
        customerRelationNo: customer.customerRelationNo,

        name: customer.customerName,
        contact: customer.customerPhone,
        address: customer.customerAddress,
        email: customer.customerEmail,
        crn: customer.customerRelationNo,

        products: saleProducts,
        subTotal,
        gstAmount,
        discount: productDiscount,
        grandTotal,

        billDiscount: billDiscountAmount,
        couponCode,
        couponDiscount,
        discountReason,
        totalDiscount,

        payment,
      });

      setLastInvoice(res.data.sale);
      showToast("Bill generated successfully", "success");
      setShowCustomer(false);
      setShowLastInvoice(true);
      setCart([]);
      setKeyword("");
      setCustomerSearch("");
      setCustomerResults([]);
      setBillDiscountType("Amount");
      setBillDiscountValue("");
      setDiscountReason("");
      setCouponCode("");
      setCouponDiscount(0);

      setCustomer({
        customerName: "",
        customerPhone: "",
        customerAddress: "",
        customerEmail: "",
        customerGST: "",
        customerRelationNo: "",
      });

      setPartialPayment({ cash: 0, upi: 0, card: 0 });

      fetchLatestInvoice();
    } catch (error) {
      console.log("Sale create error:", error.response?.data || error.message);
   showToast(error.response?.data?.message || "Bill punch failed");
    }
  };

  const fetchReturnInvoice = async () => {
    if (!returnInvoiceNo.trim()) {
      return showToast("Invoice number required", "warning");
    }

    try {
      const res = await API.get(`/sales-return/invoice/${returnInvoiceNo}`);

      setReturnSale(res.data.sale);

      setReturnItems(
        res.data.sale.products.map((p) => ({
          productId: p.productId,
          name: p.name,
          barcode: p.barcode,
          soldQty: p.qty,
          returnQty: 0,
          returnableQty: Number(p.returnableQty ?? p.qty ?? 0),
          rate: p.rate,
          gst: p.gst,
        }))
      );

      setShowReturnModal(true);
    } catch (error) {
      showToast(error.response?.data?.message || "Invoice not found");
    }
  };

  const updateReturnQty = (index, value) => {
    const updated = [...returnItems];
    const qty = Number(value);

    if (qty > Number(updated[index].returnableQty ?? updated[index].soldQty)) {
      return showToast("Return quantity cannot exceed available return quantity", "warning");
    }

    updated[index].returnQty = qty;
    setReturnItems(updated);
  };

  const saveSalesReturn = async () => {
    const items = returnItems
      .filter((i) => Number(i.returnQty) > 0)
      .map((i) => ({
        productId: i.productId,
        name: i.name,
        barcode: i.barcode,
        qty: Number(i.returnQty),
        rate: Number(i.rate || 0),
        gst: Number(i.gst || 0),
      }));

    if (items.length === 0) {
      return showToast("Please Select Items For Return", "warning");
    }

    try {
      await API.post("/sales-return", {
        saleId: returnSale._id,
        products: items,
      });

      showToast("Sales return saved successfully", "success");

      setShowReturnModal(false);
      setReturnInvoiceNo("");
      setReturnSale(null);
      setReturnItems([]);
      fetchLatestInvoice();
    } catch (error) {
      showToast(error.response?.data?.message || "Sales return failed");
    }
  };

  const printLastBill = () => {
    if (!lastInvoice) return showToast("Last invoice not found", "warning");
    window.print();
  };

  return (<>
    {toast && (
      <div className={`pos-toast ${toast.type}`}>
        {toast.message}
      </div>
    )}
    <div className="pos-fullscreen">
      <div className="pos-topbar">
        <button onClick={() => navigate("/")}>Home</button>

        <div className="pos-title-block">
          <button
            className="view-last-invoice-btn"
            onClick={() =>
              lastInvoice
                ? setShowLastInvoice(true)
                : showToast("Last invoice not found", "warning")
            }
          >
            <Eye size={16} />
            View Last Transaction
          </button>
        </div>

        <div className="sale-return-top">
          <input
            placeholder="Invoice No for Return"
            value={returnInvoiceNo}
            onChange={(e) => setReturnInvoiceNo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchReturnInvoice()}
          />
          <button onClick={fetchReturnInvoice}>
            <RotateCcw size={17} />
            Return
          </button>
        </div>
      </div>

      <div className="pos-layout">
        <main className="pos-left">
          <div className="pos-search-box">
            <input
              autoFocus
              placeholder="Scan barcode / search product name / SKU"
              value={keyword}
              onChange={(e) => searchProduct(e.target.value)}
              onKeyDown={handleSearchKey}
            />

            {results.length > 0 && (
              <div className="pos-result-box">
                {results.map((p) => (
                  <div key={p._id} onClick={() => addProduct(p)}>
                    <b>{p.name}</b>
                    <span>
                      Barcode: {p.barcode} | Stock: {p.stock} | ₹
                      {p.sellingPrice}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pos-table-card">
            <h2>Cart Products</h2>

            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Qty</th>
                  <th>MRP</th>
                  <th>Rate</th>
                  <th>GST</th>
                  <th>Discount</th>
                  <th>Total</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan="9">No product added</td>
                  </tr>
                ) : (
                  cart.map((i, idx) => {
                    const line = Number(i.rate) * Number(i.qty);
                    const itemDiscount = Number(i.discount || 0);
                    const itemGst =
                      ((line - itemDiscount) * Number(i.gst || 0)) / 100;
                    const total = line - itemDiscount + itemGst;

                    return (
                      <tr key={idx}>
                        <td>{i.name}</td>
                        <td>{i.barcode}</td>

                        <td className="qty-cell">
                          <div className="qty-control">
                            <button
                              className="qty-minus"
                              onClick={() => {
                                if (Number(i.qty) > 1) {
                                  updateCart(idx, "qty", Number(i.qty) - 1);
                                }
                              }}
                            >
                              -
                            </button>

                            <span>{i.qty}</span>

                            <button
                              className="qty-plus"
                              onClick={() => {
                                if (Number(i.qty) < Number(i.stock)) {
                                  updateCart(idx, "qty", Number(i.qty) + 1);
                                }
                              }}
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td>₹{i.mrp}</td>
                        <td>₹{i.rate}</td>
                        <td>{i.gst}%</td>

                        <td>
                          <input
                            type="number"
                            value={i.discount}
                            onChange={(e) =>
                              updateCart(idx, "discount", e.target.value)
                            }
                          />
                        </td>

                        <td>₹{total.toFixed(2)}</td>

                        <td>
                          <button
                            className="danger-btn"
                            onClick={() => remove(idx)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </main>

        <aside className="pos-right">
          <div className="pos-summary">
            <h2>Bill Summary</h2>

            <p>
              <span>Total Items</span>
              <b>{cart.length}</b>
            </p>

            <p>
              <span>Total Qty</span>
              <b>{totalQty}</b>
            </p>

            <p>
              <span>Subtotal</span>
              <b>₹{subTotal.toFixed(2)}</b>
            </p>

            <p>
              <span>GST</span>
              <b>₹{gstAmount.toFixed(2)}</b>
            </p>

            <p>
              <span>Product Discount</span>
              <b>₹{productDiscount.toFixed(2)}</b>
            </p>

            <div className="bill-discount-box">
              <select
                value={billDiscountType}
                onChange={(e) => setBillDiscountType(e.target.value)}
              >
                <option value="Amount">Amount</option>
                <option value="Percent">Percent</option>
              </select>

              <input
                type="number"
                placeholder="Bill Discount"
                value={billDiscountValue}
                onChange={(e) => setBillDiscountValue(e.target.value)}
              />
            </div>

            <div className="coupon-box">
              <input
                placeholder="Coupon Code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              />

              <button type="button" onClick={applyCoupon}>
                Apply
              </button>
            </div>

            <textarea
              placeholder="Discount Reason"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
            />

            <p>
              <span>Coupon Discount</span>
              <b>₹{Number(couponDiscount || 0).toFixed(2)}</b>
            </p>

            <p>
              <span>Total Discount</span>
              <b>₹{totalDiscount.toFixed(2)}</b>
            </p>

            <h3>Total Bill: ₹{grandTotal.toFixed(2)}</h3>
          </div>

          <div className="pos-last-invoice">
            <h2>Latest Invoice</h2>

            {lastInvoice ? (
              <>
                <p>Invoice: {lastInvoice.invoiceNo}</p>
                <p>Customer: {lastInvoice.customerName}</p>
                <p>Total: ₹{lastInvoice.grandTotal}</p>

                <button onClick={() => setShowLastInvoice(true)}>
                  View Last Invoice
                </button>

                <button onClick={printLastBill}>Print Last Bill</button>
              </>
            ) : (
              <p>No invoice generated yet</p>
            )}
          </div>
        </aside>
      </div>

      <div className="pos-bottom-payment">
        <div className="payment-total-strip">
          <span>Total Bill</span>
          <strong>₹{grandTotal.toFixed(2)}</strong>
        </div>

        {(settings?.cashEnabled ?? true) && (
          <button onClick={() => openPayment("Cash")}>Cash</button>
        )}

        {(settings?.upiEnabled ?? true) && (
          <button onClick={() => openPayment("UPI")}>UPI</button>
        )}

        {(settings?.cardEnabled ?? true) && (
          <button onClick={() => openPayment("Card")}>Card</button>
        )}

        {(settings?.partialPaymentEnabled ?? true) && (
          <button onClick={() => openPayment("Partial")}>Partial</button>
        )}
      </div>

      {showPartial && (
        <div className="pos-modal-overlay">
          <div className="pos-modal">
            <div className="pos-modal-head">
              <h2>Partial Payment</h2>
              <button onClick={() => setShowPartial(false)}>×</button>
            </div>

            <input
              type="number"
              placeholder="Cash Amount"
              value={partialPayment.cash}
              onChange={(e) =>
                setPartialPayment({ ...partialPayment, cash: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="UPI Amount"
              value={partialPayment.upi}
              onChange={(e) =>
                setPartialPayment({ ...partialPayment, upi: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="Card Amount"
              value={partialPayment.card}
              onChange={(e) =>
                setPartialPayment({ ...partialPayment, card: e.target.value })
              }
            />

            <button onClick={submitPartial}>Submit Payment</button>
          </div>
        </div>
      )}

      {showCustomer && (
        <div className="pos-modal-overlay">
          <div className="pos-modal large">
            <div className="pos-modal-head">
              <h2>Customer Details</h2>
              <button onClick={() => setShowCustomer(false)}>×</button>
            </div>

            <div className="pos-customer-grid">
              <div className="customer-search-wrap">
                <input
                  placeholder="Search CRN / Name / Mobile"
                  value={customerSearch}
                  onChange={(e) => searchCustomer(e.target.value)}
                />

                {customerResults.length > 0 && (
                  <div className="customer-search-dropdown">
                    {customerResults.map((c) => (
                      <div key={c._id} onClick={() => selectCustomer(c)}>
                        <b>
                          {c.crn} - {c.name}
                        </b>
                        <span>{c.contact}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <input
                placeholder="Customer Name *"
                value={customer.customerName}
                onChange={(e) =>
                  setCustomer({ ...customer, customerName: e.target.value })
                }
              />

              <PhoneInput
                placeholder="Mobile number"
                value={customer.customerPhone}
                onChange={(value) => setCustomer({ ...customer, customerPhone: value })}
                required
              />

              <input
                placeholder="Address *"
                value={customer.customerAddress}
                onChange={(e) =>
                  setCustomer({ ...customer, customerAddress: e.target.value })
                }
              />

              <input
                placeholder="Email"
                value={customer.customerEmail}
                onChange={(e) =>
                  setCustomer({ ...customer, customerEmail: e.target.value })
                }
              />

              <input
                placeholder="GST Optional"
                value={customer.customerGST}
                onChange={(e) =>
                  setCustomer({ ...customer, customerGST: e.target.value })
                }
              />
            </div>

            <button onClick={punchBill}>Punch Bill & Print</button>
          </div>
        </div>
      )}

      {showReturnModal && returnSale && (
        <div className="pos-modal-overlay">
          <div className="pos-modal large invoice-modal">
            <div className="pos-modal-head no-print">
              <h2>Sales Return - {returnSale.invoiceNo}</h2>
              <button onClick={() => setShowReturnModal(false)}>×</button>
            </div>

            <div className="return-info-box">
              <p>
                <b>Customer:</b> {returnSale.customerName}
              </p>
              <p>
                <b>Phone:</b> {returnSale.customerPhone}
              </p>
              <p>
                <b>Total Bill:</b> ₹{returnSale.grandTotal}
              </p>
            </div>

            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Return</th>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Sold Qty</th>
                  <th>Returnable</th>
                  <th>Return Qty</th>
                  <th>Rate</th>
                  <th>GST</th>
                </tr>
              </thead>

              <tbody>
                {returnItems.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="checkbox"
                        checked={Number(item.returnQty) > 0}
                        onChange={(e) =>
                          updateReturnQty(index, e.target.checked ? 1 : 0)
                        }
                      />
                    </td>

                    <td>{item.name}</td>
                    <td>{item.barcode}</td>
                    <td>{item.soldQty}</td>
                    <td>{item.returnableQty}</td>

                    <td>
                      <input
                        type="number"
                        min="0"
                        max={item.returnableQty}
                        value={item.returnQty}
                        onChange={(e) => updateReturnQty(index, e.target.value)}
                      />
                    </td>

                    <td>₹{item.rate}</td>
                    <td>{item.gst}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button className="save-return-btn" onClick={saveSalesReturn}>
              Save Sales Return
            </button>
          </div>
        </div>
      )}

      {showLastInvoice && lastInvoice && (
        <div className="pos-modal-overlay">
          <div className="pos-modal large invoice-modal last-invoice-modal">
            <div className="pos-modal-head no-print">
              <h2>Latest Invoice</h2>
              <button onClick={() => setShowLastInvoice(false)}>×</button>
            </div>

            <InvoiceContent invoice={lastInvoice} settings={settings} />

            <button className="no-print" onClick={printLastBill}>
              Print Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  </>
  );
}
