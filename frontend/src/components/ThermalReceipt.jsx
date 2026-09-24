import { createPortal } from "react-dom";
import "./ThermalReceipt.css";

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;

const signedMoney = (value) => {
  const amount = Number(value || 0);
  return `${amount < 0 ? "-" : ""}₹${Math.abs(amount).toFixed(2)}`;
};

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString("en-GB");
};

const formatTime = (value) => {
  const date = value ? new Date(value) : new Date();
  return date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
};

const paperConfig = (settings) => {
  const size = String(settings?.invoicePrintSize || "80MM").toUpperCase();
  if (size === "58MM") return { className: "receipt-58", pageRule: "@page { size: 58mm auto; margin: 0; }" };
  if (size === "A4") return { className: "receipt-a4", pageRule: "@page { size: A4; margin: 10mm; }" };
  return { className: "receipt-80", pageRule: "@page { size: 80mm auto; margin: 0; }" };
};

// Renders the receipt once for on-screen preview and once inside a portal that is the only
// thing visible while printing, so no other page styling can interfere with the printout.
function ReceiptFrame({ settings, children }) {
  const paper = paperConfig(settings);

  return (
    <>
      <div className={`receipt-sheet ${paper.className}`}>{children}</div>
      {createPortal(
        <div className="receipt-print-root">
          <style>{`@media print { ${paper.pageRule} }`}</style>
          <div className={`receipt-sheet ${paper.className}`}>{children}</div>
        </div>,
        document.body
      )}
    </>
  );
}

function Row({ left, right, strong }) {
  return (
    <div className={`receipt-row${strong ? " strong" : ""}`}>
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

export function TaxInvoiceReceipt({ data, settings }) {
  const totalQty = data.items.reduce((sum, item) => sum + item.qty, 0);
  const halfGst = data.gstAmount / 2;
  const roundedTotal = Math.round(data.grandTotal);
  const roundOff = roundedTotal - data.grandTotal;
  const showStore = settings?.showStoreDetails ?? true;
  const showGst = settings?.showGSTDetails ?? true;
  const showCustomer = settings?.showCustomerDetails ?? true;
  const showThanks = settings?.showThankYou ?? true;
  const terms = (settings?.showTerms ?? true) ? settings?.termsAndConditions?.trim() : "";
  const returnPolicy = (settings?.showReturnPolicy ?? true) ? settings?.returnPolicy?.trim() : "";

  return (
    <ReceiptFrame settings={settings}>
      <div className="receipt-center">
        <div className="receipt-store">{settings?.storeName || "RestroSethu"}</div>
        {showStore && settings?.storeAddress && <div className="receipt-small">{settings.storeAddress}</div>}
        {showStore && settings?.storeContact && <div className="receipt-small">Phone: {settings.storeContact}</div>}
        {showGst && settings?.gstNumber && <div className="receipt-small">GSTIN: {settings.gstNumber}</div>}
        <div className="receipt-title">TAX INVOICE</div>
      </div>

      <div className="receipt-line solid" />
      {showCustomer && (
        <>
          <div className="receipt-name">
            Name: <b>{data.customerName}</b>
          </div>
          <div className="receipt-line dashed" />
        </>
      )}

      <Row left={`Date: ${formatDate(data.dateValue)}`} right={`Bill#: ${data.billNo || "-"}`} />
      <Row left={`Time: ${formatTime(data.dateValue)}`} right={data.tableLabel ? `Table: ${data.tableLabel}` : ""} />

      <div className="receipt-line solid" />
      <div className="receipt-grid head">
        <span>Item</span>
        <span className="num">Qty</span>
        <span className="num">Price</span>
        <span className="num">Amt</span>
      </div>
      <div className="receipt-line dashed" />

      {data.items.map((item, index) => (
        <div className="receipt-grid" key={`${item.name}-${index}`}>
          <span className="item-name">{item.name}</span>
          <span className="num">{item.qty}</span>
          <span className="num">{money(item.rate)}</span>
          <span className="num">{money(item.total)}</span>
        </div>
      ))}

      <div className="receipt-line solid" />
      <Row left={`Total Qty: ${totalQty}`} right={`Sub Total: ${money(data.subTotal)}`} />
      {data.gstAmount > 0 && (
        <>
          <Row left={`CGST${data.halfRate ? ` (${data.halfRate})` : ""}`} right={money(halfGst)} />
          <Row left={`SGST${data.halfRate ? ` (${data.halfRate})` : ""}`} right={money(halfGst)} />
        </>
      )}
      {data.discount > 0 && <Row left="Discount" right={signedMoney(-data.discount)} />}
      <Row left="Round Off" right={signedMoney(roundOff)} />

      <div className="receipt-line solid" />
      <Row left="Grand Total" right={money(roundedTotal)} strong />
      <Row left="Payment" right={data.paymentLabel} />
      <div className="receipt-line solid" />

      {(terms || returnPolicy) && (
        <div className="receipt-policies">
          {terms && (
            <p>
              <b>Terms:</b> {terms}
            </p>
          )}
          {returnPolicy && (
            <p>
              <b>Returns:</b> {returnPolicy}
            </p>
          )}
        </div>
      )}

      <div className="receipt-center receipt-thanks">
        {showThanks && <div>{settings?.thankYouMessage || "Thank you for dining with us!"}</div>}
        {showThanks && <div>Visit again.</div>}
        <div className="receipt-powered">Powered by RestroSethu</div>
      </div>
      <div className="receipt-line dashed" />
    </ReceiptFrame>
  );
}

export function KotReceipt({ order, settings }) {
  const items = order.items || [];
  const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const isDelivery = order.orderType === "delivery";
  const dateValue = order.kotSentAt || order.createdAt;

  return (
    <ReceiptFrame settings={settings}>
      <div className="receipt-center">
        <div className="receipt-title kot">KOT</div>
        <div className="receipt-store small">{settings?.storeName || "RestroSethu"}</div>
      </div>

      <div className="receipt-line solid" />
      <Row
        left={isDelivery ? `Order: ${order.orderNo || "-"}` : `Table: Table ${order.tableNo || "-"}`}
        right={isDelivery ? "Delivery" : "Dine In"}
      />
      <Row
        left={`${formatDate(dateValue)}  ${formatTime(dateValue)}`}
        right={isDelivery ? "" : `Order: ${order.orderNo || "-"}`}
      />

      <div className="receipt-line solid" />
      <div className="receipt-kot-head">
        <span>ITEM</span>
        <span>QTY</span>
      </div>
      <div className="receipt-line dashed" />

      {items.map((item, index) => (
        <div className="receipt-kot-row" key={`${item.name}-${index}`}>
          <span className="kot-item">
            <span className="kot-index">{index + 1}.</span>
            <span>{item.name}</span>
          </span>
          <span className="kot-qty">{item.qty}</span>
        </div>
      ))}

      {order.note && (
        <div className="receipt-kot-note">
          <b>Note:</b> {order.note}
        </div>
      )}

      <div className="receipt-line solid" />
      <div className="receipt-kot-total">
        Total: <b>{totalQty}</b> {totalQty === 1 ? "item" : "items"}
      </div>
      <div className="receipt-center receipt-powered">Powered by RestroSethu</div>
      <div className="receipt-line dashed" />
    </ReceiptFrame>
  );
}
