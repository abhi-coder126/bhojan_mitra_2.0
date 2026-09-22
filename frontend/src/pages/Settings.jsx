import { useEffect, useState } from "react";
import {
  Store,
  Receipt,
  Wallet,
  Utensils,
  Bell,
  ShieldCheck,
  DatabaseBackup,
} from "lucide-react";
import API from "../api/axios";
import { ToastViewport, useToast } from "../components/Toast";
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
  whatsappNumber: "",
  businessOpenTime: "09:00",
  businessCloseTime: "23:00",

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
  autoAcceptOrders: false,

  lowStockAlertQty: 5,
  expiryAlertDays: 30,
  themeMode: "light",
  currencySymbol: "Rs",
  dateFormat: "DD-MM-YYYY",
  timezone: "Asia/Kolkata",

  sessionTimeoutMinutes: 60,
  maintenanceMode: false,
};

const tabs = [
  { key: "store", label: "Store & Business", icon: Store },
  { key: "invoice", label: "Invoice & Billing", icon: Receipt },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "restaurant", label: "Restaurant Operations", icon: Utensils },
  { key: "notifications", label: "Notifications & Display", icon: Bell },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "data", label: "Data Management", icon: DatabaseBackup },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("store");
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [cleanupTarget, setCleanupTarget] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const { toast, showToast } = useToast();

  const fetchSettings = async () => {
    try {
      const res = await API.get("/settings");
      setSettings({ ...defaultSettings, ...(res.data.settings || {}) });
    } catch (error) {
      showToast(error.response?.data?.message || "Settings fetch failed");
    }
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        sessionTimeoutMinutes: Math.max(5, Number(settings.sessionTimeoutMinutes || 60)),
      });
      showToast("Settings saved successfully", "success");
      fetchSettings();
    } catch (error) {
      showToast(error.response?.data?.message || "Settings save failed");
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      return showToast("Fill in both password fields", "warning");
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return showToast("New password and confirm password do not match", "warning");
    }

    setChangingPassword(true);
    try {
      await API.put("/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      showToast("Password updated successfully", "success");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      showToast(error.response?.data?.message || "Password update failed");
    } finally {
      setChangingPassword(false);
    }
  };

  const playTestSound = () => {
    if (!settings.restaurantOrderSoundEnabled) {
      showToast("New order sound is disabled", "warning");
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      showToast("Audio is not supported in this browser");
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
      showToast(`${cleanupTarget.label} deleted successfully`, "success");
      setCleanupTarget(null);
    } catch (error) {
      showToast(error.response?.data?.message || "Cleanup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <ToastViewport toast={toast} />

      <div className="settings-head">
        <div>
          <h1>System Settings</h1>
          <p>Configure store details, invoice policies, payment modes and system preferences</p>
        </div>

        <button onClick={saveSettings} disabled={loading}>
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="settings-layout">
        <nav className="settings-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? "active" : ""}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon size={17} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="settings-panel">
          {activeTab === "store" && (
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

                <PhoneInput
                  placeholder="WhatsApp number for order updates"
                  value={settings.whatsappNumber}
                  onChange={(value) => change("whatsappNumber", value)}
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

              <h2 className="settings-subhead">Business Hours</h2>
              <div className="settings-form-grid">
                <label className="settings-inline-field">
                  <span>Opens at</span>
                  <input
                    type="time"
                    value={settings.businessOpenTime}
                    onChange={(e) => change("businessOpenTime", e.target.value)}
                  />
                </label>
                <label className="settings-inline-field">
                  <span>Closes at</span>
                  <input
                    type="time"
                    value={settings.businessCloseTime}
                    onChange={(e) => change("businessCloseTime", e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === "invoice" && (
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

                <select
                  value={settings.currencySymbol}
                  onChange={(e) => change("currencySymbol", e.target.value)}
                >
                  <option value="Rs">Rs (Rupee)</option>
                  <option value="$">$ (Dollar)</option>
                  <option value="€">{"€"} (Euro)</option>
                  <option value="£">{"£"} (Pound)</option>
                </select>

                <select
                  value={settings.dateFormat}
                  onChange={(e) => change("dateFormat", e.target.value)}
                >
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
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

              <h2 className="settings-subhead">Show / Hide Invoice Data</h2>
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
          )}

          {activeTab === "payments" && (
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
          )}

          {activeTab === "restaurant" && (
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
                <Toggle
                  title="Auto-Accept Orders"
                  description="Skip the manual accept step and send new QR orders straight to the kitchen."
                  value={settings.autoAcceptOrders}
                  onClick={() => change("autoAcceptOrders", !settings.autoAcceptOrders)}
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
          )}

          {activeTab === "notifications" && (
            <div className="settings-section">
              <h2>Notifications & Display</h2>

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

                <select
                  value={settings.timezone}
                  onChange={(e) => change("timezone", e.target.value)}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Kathmandu">Asia/Kathmandu (NPT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="settings-section">
              <h2>Security</h2>

              <div className="settings-form-grid">
                <label className="settings-inline-field">
                  <span>Auto-logout after (minutes idle)</span>
                  <input
                    type="number"
                    min="5"
                    value={settings.sessionTimeoutMinutes}
                    onChange={(e) => change("sessionTimeoutMinutes", e.target.value)}
                  />
                </label>
              </div>

              <div className="settings-grid">
                <Toggle
                  title="Maintenance Mode"
                  description="Temporarily block the customer QR menu while you make changes."
                  value={settings.maintenanceMode}
                  onClick={() => change("maintenanceMode", !settings.maintenanceMode)}
                />
              </div>

              <h2 className="settings-subhead">Change Password</h2>
              <form className="settings-form-grid" onSubmit={changePassword}>
                <input
                  type="password"
                  placeholder="Current password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                />
                <button type="submit" disabled={changingPassword} className="settings-password-btn">
                  {changingPassword ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          )}

          {activeTab === "data" && (
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
          )}
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
