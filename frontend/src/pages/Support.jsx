import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, LifeBuoy, Mail, MessageCircle, Phone } from "lucide-react";
import { usePlatform } from "../api/platform";
import { getActiveBranch, getUser, isMasterAdmin } from "../api/session";

const CATEGORIES = ["Billing / invoices", "Orders & KOT", "QR menu", "Menu & inventory", "Login / access", "Printer", "Other"];

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

export default function Support() {
  const platform = usePlatform();
  const support = platform?.support || {};
  const user = getUser();
  const branch = getActiveBranch();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [issue, setIssue] = useState("");

  // Sent with every channel so support knows who is asking without a back-and-forth.
  const message = useMemo(
    () =>
      [
        `Hello ${support.name || "Support"}, I need help.`,
        "",
        `Issue type: ${category}`,
        `Details: ${issue.trim() || "(please describe)"}`,
        "",
        `Name: ${user.name || "-"} (${user.role || "-"})`,
        `Branch: ${branch ? `${branch.name} (${branch.code})` : "Head office"}`,
        `Login: ${user.email || "-"}`,
        `Time: ${new Date().toLocaleString("en-IN")}`,
      ].join("\n"),
    [branch, category, issue, support.name, user.email, user.name, user.role]
  );

  const whatsappNumber = digitsOnly(support.whatsapp);
  const channels = [
    whatsappNumber && {
      key: "whatsapp",
      icon: MessageCircle,
      title: "Chat on WhatsApp",
      detail: support.whatsapp,
      href: `https://wa.me/${whatsappNumber.length === 10 ? `91${whatsappNumber}` : whatsappNumber}?text=${encodeURIComponent(message)}`,
      external: true,
    },
    support.phone && {
      key: "phone",
      icon: Phone,
      title: "Call support",
      detail: support.phone,
      href: `tel:${support.phone.replace(/[^\d+]/g, "")}`,
    },
    support.email && {
      key: "email",
      icon: Mail,
      title: "Email support",
      detail: support.email,
      href: `mailto:${support.email}?subject=${encodeURIComponent(
        `[${branch?.code || "HQ"}] ${category}`
      )}&body=${encodeURIComponent(message)}`,
    },
  ].filter(Boolean);

  return (
    <div className="bm-page">
      <div className="bm-head">
        <div>
          <h1>Support</h1>
          <p>Facing an issue? Tell us what happened and reach the support team in one tap.</p>
        </div>
      </div>

      <div className="bm-card">
        <h2>1. Describe the issue</h2>
        <p className="bm-muted">Your name, branch and login are added to the message automatically.</p>
        <div className="bm-grid" style={{ marginTop: 14 }}>
          <div className="bm-field">
            <label htmlFor="support-category">Issue type</label>
            <select id="support-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="bm-field bm-field-full">
            <label htmlFor="support-issue">What happened?</label>
            <textarea
              id="support-issue"
              rows={4}
              maxLength={1000}
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="e.g. Invoice is not printing after marking the order paid on table 4"
            />
          </div>
        </div>
      </div>

      <div className="bm-card">
        <h2>2. Contact support</h2>
        {support.hours && (
          <p className="bm-muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={14} /> {support.hours}
          </p>
        )}

        {!platform ? (
          <div className="bm-empty">Loading support details...</div>
        ) : channels.length === 0 ? (
          <div className="bm-notice" style={{ marginTop: 12 }}>
            <LifeBuoy size={18} />
            <span>
              Support contacts haven't been set up yet.{" "}
              {isMasterAdmin() ? (
                <>
                  Add them in <Link to="/settings">Settings → Support contacts</Link>.
                </>
              ) : (
                "Please contact your head office."
              )}
            </span>
          </div>
        ) : (
          <div className="bm-support-grid" style={{ marginTop: 12 }}>
            {channels.map(({ key, icon: Icon, title, detail, href, external }) => (
              <a
                key={key}
                className={`bm-support-channel is-${key}`}
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                <span className="bm-support-icon">
                  <Icon size={20} />
                </span>
                <strong>{title}</strong>
                <span>{detail}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
