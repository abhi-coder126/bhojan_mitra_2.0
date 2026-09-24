// Converts a restaurant order or a POS sale into one common shape for the tax invoice.
export function toInvoiceData(source, kind) {
  const isOrder = kind === "order";
  const rawItems = (isOrder ? source.items : source.products) || [];

  const items = rawItems.map((item) => ({
    name: item.name,
    qty: Number(item.qty || 0),
    rate: Number(item.rate || 0),
    total: Number(item.total || 0),
    gst: Number(item.gst || 0),
  }));

  const gstRates = [...new Set(items.map((item) => item.gst).filter((rate) => rate > 0))];
  const halfRate = gstRates.length === 1 ? `${gstRates[0] / 2}%` : "";

  const paymentLabel = isOrder
    ? String(source.payment?.mode || "").toUpperCase()
    : Object.entries(source.payment || {})
        .filter(([, amount]) => Number(amount) > 0)
        .map(([mode]) => mode.toUpperCase())
        .join(" + ");

  return {
    billNo: isOrder ? source.invoiceNo || source.orderNo : source.invoiceNo,
    customerName: source.customerName || "Walk-in Customer",
    dateValue: isOrder ? source.payment?.paidAt || source.updatedAt || source.createdAt : source.createdAt,
    tableLabel: isOrder
      ? source.orderType === "delivery"
        ? "Delivery"
        : source.tableNo
          ? `Table ${source.tableNo}`
          : ""
      : "",
    items,
    subTotal: Number(source.subTotal || 0),
    gstAmount: Number(source.gstAmount || 0),
    halfRate,
    discount: Number(isOrder ? source.discountAmount : source.totalDiscount) || 0,
    grandTotal: Number(source.grandTotal || 0),
    paymentLabel: paymentLabel || "N/A",
  };
}
