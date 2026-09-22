import { useEffect, useState } from "react";
import { QrCode, Printer, RefreshCcw } from "lucide-react";

export default function TableBarcodes() {
  const [tableCount, setTableCount] = useState(28);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (import.meta.env.VITE_CUSTOMER_MENU_BASE_URL) {
      setOrigin(import.meta.env.VITE_CUSTOMER_MENU_BASE_URL.replace(/\/$/, ""));
      return;
    }

    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port ? `:${window.location.port}` : "";
    setOrigin(`${protocol}//${host}${port}`);
  }, []);

  const tables = Array.from({ length: Number(tableCount || 0) }, (_, index) => index + 1);

  return (
    <div className="table-barcodes-page">
      <div className="page-head restaurant-head">
        <div>
          <h1>Table QR Setup</h1>
          <p>Print each table QR and place it on the table. Customers can scan it to open the menu.</p>
        </div>
        <div className="restaurant-head-actions">
          <button onClick={() => window.location.reload()}>
            <RefreshCcw size={17} />
            Refresh
          </button>
          <button onClick={() => window.print()}>
            <Printer size={17} />
            Print
          </button>
        </div>
      </div>

      <section className="qr-admin-panel table-qr-print-area">
        <div className="qr-admin-head">
          <div>
            <h2>QR Cards</h2>
            <p>Use the delivery QR on pamphlets and table QRs on restaurant tables.</p>
          </div>
          <input
            type="number"
            min="1"
            max="80"
            value={tableCount}
            onChange={(e) => setTableCount(e.target.value)}
          />
        </div>

        <div className="table-qr-grid">
          <div className="table-qr-card printable-qr-card delivery-qr-card">
            <div className="qr-image-wrap">
              {origin ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${origin}/menu/delivery`)}`}
                  alt="Delivery QR"
                />
              ) : (
                <QrCode size={68} />
              )}
            </div>
            <b>Delivery Order</b>
            <strong>Pamphlet QR</strong>
            <span>{`${origin}/menu/delivery`}</span>
          </div>

          {tables.map((table) => {
            const url = `${origin}/menu/${table}`;
            const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;

            return (
              <div className="table-qr-card printable-qr-card" key={table}>
                <div className="qr-image-wrap">
                  {origin ? <img src={qrSrc} alt={`Table ${table} QR`} /> : <QrCode size={68} />}
                </div>
                <b>Table {table}</b>
                <strong>Scan for menu</strong>
                <span>{url}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
