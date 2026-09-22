import { useEffect, useState } from "react";
import API from "../api/axios";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import PhoneInput from "../components/PhoneInput";

const defaultSettings = {
  storeName: "",
  storeShortName: "POS",
  storeAddress: "",
  gstNumber: "",
  storeContact: "",
  storeEmail: "",
  logo: "",

  invoicePrefix: "INV",
  invoicePrintSize: "80MM",

  thankYouMessage: "Thank you for shopping!",
  termsAndConditions: "",
  returnPolicy: "",

  showStoreDetails: true,
  showGSTDetails: true,
  showCustomerDetails: true,
  showTerms: true,
  showReturnPolicy: true,
  showThankYou: true,
  qrCodeEnabled: true,

  cashEnabled: true,
  upiEnabled: true,
  cardEnabled: true,
  partialPaymentEnabled: true,
  bankTransferEnabled: false,

  restaurantOrderSoundEnabled: true,
  restaurantOrderRepeatSound: true,
  restaurantOrderPopupEnabled: true,
  restaurantOrderRefreshSeconds: 5,
  restaurantTableCount: 28,

  lowStockAlertQty: 5,
  expiryAlertDays: 30,
  themeMode: "light",
};

export default function Settings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [cleanupTarget, setCleanupTarget] = useState(null);

  const fetchSettings = async () => {
    try {
      const res = await API.get("/settings");
      setSettings({ ...defaultSettings, ...(res.data.settings || {}) });
    } catch (error) {
      alert(error.response?.data?.message || "Settings fetch failed");
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const change = (key, value) => {
      setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));

  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      await API.put("/settings", {
        ...settings,
        restaurantOrderRefreshSeconds: Math.max(3, Number(settings.restaurantOrderRefreshSeconds || 5)),
        restaurantTableCount: Math.max(1, Number(settings.restaurantTableCount || 28)),
        lowStockAlertQty: Number(settings.lowStockAlertQty || 0),
        expiryAlertDays: Number(settings.expiryAlertDays || 0),
      });
      alert("Settings saved successfully");
      fetchSettings();
    } catch (error) {
      alert(error.response?.data?.message || "Settings save failed");
    } finally {
      setLoading(false);
    }
  };

  const playTestSound = () => {
    if (!settings.restaurantOrderSoundEnabled) {
      alert("New order sound is disabled");
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      alert("Audio is not supported in this browser");
      return;
    }

    const context = new AudioContext();
    const notes = [
      { frequency: 880, start: 0, duration: 0.14 },
      { frequency: 1174, start: 0.16, duration: 0.14 },
      { frequency: 1568, start: 0.32, duration: 0.22 },
    ];

    notes.forEach((note) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = note.frequency;
      oscillator.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.0001, context.currentTime + note.start);
      gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + note.start + note.duration);
      oscillator.start(context.currentTime + note.start);
      oscillator.stop(context.currentTime + note.start + note.duration + 0.03);
    });

    window.setTimeout(() => {
      context.close?.();
    }, 700);
  };

  const runCleanup = async (type) => {
    const cleanupMap = {
      restaurant: {
        label: "all restaurant orders and invoices",
        endpoint: "/restaurant-orders/clear/all",
      },
      pos: {
        label: "all POS invoices",
        endpoint: "/sales/clear/all",
      },
      products: {
        label: "all menu items",
        endpoint: "/products/clear/all",
      },
      all: {
        label: "all invoices, restaurant orders and menu items",
      },
    };

    const target = cleanupMap[type];
    setCleanupTarget({ type, ...target });
  };

  const confirmCleanup = async (password) => {
    const type = cleanupTarget.type;
    const cleanupMap = {
      restaurant: { endpoint: "/restaurant-orders/clear/all" },
      pos: { endpoint: "/sales/clear/all" },
      products: { endpoint: "/products/clear/all" },
    };

    try {
      setLoading(true);
      if (type === "all") {
        await API.delete(cleanupMap.restaurant.endpoint, { data: { password } });
        await API.delete(cleanupMap.pos.endpoint, { data: { password } });
        await API.delete(cleanupMap.products.endpoint, { data: { password } });
      } else {
        await API.delete(cleanupTarget.endpoint, { data: { password } });
      }
      alert(`${cleanupTarget.label} deleted successfully`);
      setCleanupTarget(null);
    } catch (error) {
      alert(error.response?.data?.message || "Cleanup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-head">
        <div>
          <h1>System Settings</h1>
          <p>Configure store details, invoice policies, payment modes and system preferences</p>
        </div>

        <button onClick={saveSettings} disabled={loading}>
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="settings-section">
        <h2>Store Settings</h2>

        <div className="settings-form-grid">
          <input
            placeholder="Store Name"
            value={settings.storeName}
            onChange={(e) => change("storeName", e.target.value)}
          />

          <input
            placeholder="Store Short Name"
            value={settings.storeShortName}
            onChange={(e) => change("storeShortName", e.target.value)}
          />

          <input
            placeholder="GST Number"
            value={settings.gstNumber}
            onChange={(e) => change("gstNumber", e.target.value)}
          />

          <PhoneInput
            placeholder="Store contact"
            value={settings.storeContact}
            onChange={(value) => change("storeContact", value)}
          />

          <input
            placeholder="Store Email"
            value={settings.storeEmail}
            onChange={(e) => change("storeEmail", e.target.value)}
          />

          <input
            placeholder="Logo URL"
            value={settings.logo}
            onChange={(e) => change("logo", e.target.value)}
          />

          <textarea
            placeholder="Store Address"
            value={settings.storeAddress}
            onChange={(e) => change("storeAddress", e.target.value)}
          />
        </div>
      </div>

      <div className="settings-section">
        <h2>Invoice Settings</h2>

        <div className="settings-form-grid">
          <input
            placeholder="Invoice Prefix"
            value={settings.invoicePrefix}
            onChange={(e) => change("invoicePrefix", e.target.value)}
          />

          <select
            value={settings.invoicePrintSize}
            onChange={(e) => change("invoicePrintSize", e.target.value)}
          >
            <option value="58MM">58MM</option>
            <option value="80MM">80MM</option>
            <option value="A4">A4</option>
          </select>

          <textarea
            placeholder="Thank You Message"
            value={settings.thankYouMessage}
            onChange={(e) => change("thankYouMessage", e.target.value)}
          />

          <textarea
            placeholder="Terms And Conditions"
            value={settings.termsAndConditions}
            onChange={(e) => change("termsAndConditions", e.target.value)}
          />

          <textarea
            placeholder="Return Policy"
            value={settings.returnPolicy}
            onChange={(e) => change("returnPolicy", e.target.value)}
          />
        </div>
      </div>

      <div className="settings-section">
        <h2>Show / Hide Invoice Data</h2>

        <div className="settings-grid">
          <Toggle title="Store Details" value={settings.showStoreDetails} onClick={() => change("showStoreDetails", !settings.showStoreDetails)} />
          <Toggle title="GST Details" value={settings.showGSTDetails} onClick={() => change("showGSTDetails", !settings.showGSTDetails)} />
          <Toggle title="Customer Details" value={settings.showCustomerDetails} onClick={() => change("showCustomerDetails", !settings.showCustomerDetails)} />
          <Toggle title="Terms" value={settings.showTerms} onClick={() => change("showTerms", !settings.showTerms)} />
          <Toggle title="Return Policy" value={settings.showReturnPolicy} onClick={() => change("showReturnPolicy", !settings.showReturnPolicy)} />
          <Toggle title="Thank You Message" value={settings.showThankYou} onClick={() => change("showThankYou", !settings.showThankYou)} />
          <Toggle title="QR Code" value={settings.qrCodeEnabled} onClick={() => change("qrCodeEnabled", !settings.qrCodeEnabled)} />
        </div>
      </div>

      <div className="settings-section">
        <h2>Payment Modes</h2>

        <div className="settings-grid">
          <Toggle title="Cash" value={settings.cashEnabled} onClick={() => change("cashEnabled", !settings.cashEnabled)} />
          <Toggle title="UPI" value={settings.upiEnabled} onClick={() => change("upiEnabled", !settings.upiEnabled)} />
          <Toggle title="Card" value={settings.cardEnabled} onClick={() => change("cardEnabled", !settings.cardEnabled)} />
          <Toggle title="Partial Payment" value={settings.partialPaymentEnabled} onClick={() => change("partialPaymentEnabled", !settings.partialPaymentEnabled)} />
          <Toggle title="Bank Transfer" value={settings.bankTransferEnabled} onClick={() => change("bankTransferEnabled", !settings.bankTransferEnabled)} />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          <div>
            <h2>Restaurant Order Settings</h2>
            <p>Control QR order alerts, table count and live refresh timing.</p>
          </div>
          <button type="button" onClick={playTestSound}>
            Test Sound
          </button>
        </div>

        <div className="settings-grid">
          <Toggle
            title="New Order Sound"
            description="Play a counter alert when a new QR order arrives."
            value={settings.restaurantOrderSoundEnabled}
            onClick={() => change("restaurantOrderSoundEnabled", !settings.restaurantOrderSoundEnabled)}
          />
          <Toggle
            title="Repeat Sound"
            description="Keep ringing until the new order is accepted."
            value={settings.restaurantOrderRepeatSound}
            onClick={() => change("restaurantOrderRepeatSound", !settings.restaurantOrderRepeatSound)}
          />
          <Toggle
            title="Order Popup"
            description="Show the accept popup for new table orders."
            value={settings.restaurantOrderPopupEnabled}
            onClick={() => change("restaurantOrderPopupEnabled", !settings.restaurantOrderPopupEnabled)}
          />
        </div>

        <div className="settings-form-grid settings-order-fields">
          <label>
            <span>Auto Refresh Seconds</span>
            <input
              type="number"
              min="3"
              placeholder="Auto Refresh Seconds"
              value={settings.restaurantOrderRefreshSeconds}
              onChange={(e) => change("restaurantOrderRefreshSeconds", e.target.value)}
            />
          </label>

          <label>
            <span>Total Tables</span>
            <input
              type="number"
              min="1"
              placeholder="Total Tables"
              value={settings.restaurantTableCount}
              onChange={(e) => change("restaurantTableCount", e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h2>General System Settings</h2>

        <div className="settings-form-grid">
          <input
            type="number"
            placeholder="Low Stock Alert Qty"
            value={settings.lowStockAlertQty}
            onChange={(e) => change("lowStockAlertQty", e.target.value)}
          />

          <input
            type="number"
            placeholder="Expiry Alert Days"
            value={settings.expiryAlertDays}
            onChange={(e) => change("expiryAlertDays", e.target.value)}
          />

          <select
            value={settings.themeMode}
            onChange={(e) => change("themeMode", e.target.value)}
          >
            <option value="light">Light Mode</option>
            <option value="dark">Dark Mode</option>
          </select>
        </div>
      </div>

      <div className="settings-section danger-settings-section">
        <div className="settings-section-title">
          <div>
            <h2>Testing / Data Cleanup</h2>
            <p>Delete testing data when you want to add fresh items and invoices again.</p>
          </div>
        </div>

        <div className="cleanup-grid">
          <button type="button" onClick={() => runCleanup("restaurant")} disabled={loading}>
            Delete Restaurant Orders & Invoices
          </button>
          <button type="button" onClick={() => runCleanup("pos")} disabled={loading}>
            Delete POS Invoices
          </button>
          <button type="button" onClick={() => runCleanup("products")} disabled={loading}>
            Delete All Menu Items
          </button>
          <button type="button" className="danger-clear-all" onClick={() => runCleanup("all")} disabled={loading}>
            Delete All Testing Data
          </button>
        </div>
      </div>
      <DeleteConfirmModal
        open={!!cleanupTarget}
        title="Delete Testing Data?"
        message={`${cleanupTarget?.label || "Selected records"} will be deleted. Enter login password to continue.`}
        confirmText="Delete Data"
        onCancel={() => setCleanupTarget(null)}
        onConfirm={confirmCleanup}
      />
    </div>
  );
}

function Toggle({ title, description, value, onClick }) {
  return (
    <div className="settings-card">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <button className={`switch-btn ${value ? "active" : ""}`} onClick={onClick}>
        <span></span>
      </button>
    </div>
  );
}
