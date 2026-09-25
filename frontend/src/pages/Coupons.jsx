import { TicketPercent, Eye, Sparkles, Tag } from "lucide-react";
import "./Coupons.css";
import AsyncForm from "../components/AsyncForm";
import { useEffect, useState } from "react";
import API from "../api/axios";
import { SkeletonTable } from "../components/Skeleton";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { ToastViewport, useToast } from "../components/Toast";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const emptyCoupon = { code: "", title: "", description: "", showOnMenu: true, activeDays: [0,1,2,3,4,5,6], discountType: "Amount", discountValue: "", minimumBillAmount: "", usageLimit: "", startDate: "", endDate: "", status: "Active" };
const dateInput = (value) => value ? new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0,10) : "";

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyCoupon);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast, showToast } = useToast();
  const fetchCoupons = async () => { const res = await API.get("/coupons"); setCoupons(res.data.coupons || []); };
  useEffect(() => { fetchCoupons().catch(() => showToast("Offers could not be loaded")).finally(() => setLoading(false)); }, [showToast]);
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const reset = () => { setEditingId(null); setForm(emptyCoupon); };
  const submit = async (event) => {
    event.preventDefault();
    if (!form.activeDays.length) return showToast("Select at least one offer day", "warning");
    try {
      const payload = { ...form, discountValue: Number(form.discountValue), minimumBillAmount: Number(form.minimumBillAmount || 0), usageLimit: Number(form.usageLimit || 0) };
      if (editingId) await API.put(`/coupons/${editingId}`, payload);
      else await API.post("/coupons", payload);
      showToast(editingId ? "Offer updated" : "Offer created", "success");
      reset(); await fetchCoupons();
    } catch (error) { showToast(error.response?.data?.message || "Offer could not be saved"); }
  };
  const edit = (coupon) => {
    setEditingId(coupon._id);
    setForm({ ...emptyCoupon, ...coupon, activeDays: coupon.activeDays || [0,1,2,3,4,5,6], startDate: dateInput(coupon.startDate), endDate: dateInput(coupon.endDate) });
    document.querySelector(".coupon-editor")?.scrollIntoView({ behavior: "smooth" });
  };
  const remove = async (password) => {
    await API.delete(`/coupons/${deleteTarget._id}`, { data: { password } });
    if (editingId === deleteTarget._id) reset();
    setDeleteTarget(null); await fetchCoupons();
  };
  return (
    <div className="settings-page coupons-page">
      <ToastViewport toast={toast} />
      <div className="settings-head"><div><span className="cp-eyebrow">GROW YOUR RESTAURANT</span><h1>Offers &amp; Coupons</h1><p>A little extra delight. A reason to come back.</p></div></div>
      <section className="cp-stats" aria-label="Offer overview">
        <div><span className="cp-stat-icon purple"><TicketPercent size={22} /></span><p>Total offers<strong>{loading ? "—" : coupons.length}</strong></p></div>
        <div><span className="cp-stat-icon green"><Sparkles size={22} /></span><p>Active offers<strong>{loading ? "—" : coupons.filter((c) => c.status === "Active").length}</strong></p></div>
        <div><span className="cp-stat-icon orange"><Tag size={22} /></span><p>Total redemptions<strong>{loading ? "—" : coupons.reduce((sum, c) => sum + Number(c.usedCount || 0), 0)}</strong></p></div>
      </section>
      <div className="cp-workspace">
      <AsyncForm className="panel coupon-editor" onSubmit={submit}>
        <div className="cp-editor-heading"><span><TicketPercent size={23} /></span><div><h2>{editingId ? "Edit your offer" : "Build your next offer"}</h2><p>Set the details and give your guests something special.</p></div></div>
        <div className="coupon-editor-grid">
          <label>Coupon code<input placeholder="WELCOME20" value={form.code} onChange={(e) => change("code", e.target.value.toUpperCase())} maxLength={40} required /></label>
          <label>Offer title<input placeholder="20% off your favourites" value={form.title} onChange={(e) => change("title", e.target.value)} maxLength={100} /></label>
          <label>Discount type<select value={form.discountType} onChange={(e) => change("discountType", e.target.value)}><option value="Amount">Fixed amount (₹)</option><option value="Percent">Percentage (%)</option></select></label>
          <label>Discount value<input type="number" min="0.01" max={form.discountType === "Percent" ? 100 : undefined} step="0.01" value={form.discountValue} onChange={(e) => change("discountValue", e.target.value)} required /></label>
          <label>Minimum order (₹)<input type="number" min="0" step="0.01" placeholder="0" value={form.minimumBillAmount} onChange={(e) => change("minimumBillAmount", e.target.value)} /></label>
          <label>Total usage limit<input type="number" min="0" step="1" placeholder="0 = unlimited" value={form.usageLimit} onChange={(e) => change("usageLimit", e.target.value)} /></label>
          <label>Start date<input type="date" value={form.startDate} onChange={(e) => change("startDate", e.target.value)} /></label>
          <label>End date (inclusive)<input type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => change("endDate", e.target.value)} /></label>
          <label>Status<select value={form.status} onChange={(e) => change("status", e.target.value)}><option>Active</option><option>Inactive</option></select></label>
        </div>
        <label className="cp-description">Description<textarea placeholder="Tell customers about this offer" value={form.description} maxLength={220} onChange={(e) => change("description", e.target.value)} /></label>
        <fieldset className="offer-day-picker"><legend>Available days · India time (IST)</legend><div>{days.map((day,index) => <label key={day}><input type="checkbox" checked={form.activeDays.includes(index)} onChange={(e) => change("activeDays", e.target.checked ? [...form.activeDays,index] : form.activeDays.filter((value) => value !== index))} />{day}</label>)}</div></fieldset>
        <label className="offer-menu-toggle"><input type="checkbox" checked={form.showOnMenu} onChange={(e) => change("showOnMenu", e.target.checked)} />Show in Top Offers on the customer menu</label>
        <p className="cp-help">Leave dates empty to repeat on your selected days. Only eligible, active offers appear on the menu.</p>
        <div className="offer-editor-actions"><button>{editingId ? "Save Offer" : "Create Offer"}</button>{editingId && <button type="button" onClick={reset}>Cancel edit</button>}</div>
      </AsyncForm>
      <aside className="cp-preview"><div className="cp-preview-heading"><span>LIVE PREVIEW</span><Eye size={16} /></div><div className="cp-ticket"><div className="cp-ticket-top"><span className="cp-ticket-icon"><TicketPercent size={30} /></span><span>JUST FOR YOU</span><h2>{form.discountType === "Percent" ? (form.discountValue || "0") + "%" : "₹" + Number(form.discountValue || 0).toLocaleString("en-IN")} <small>OFF</small></h2><h3>{form.title || "Your next favourite offer"}</h3><p>{form.description || "Good food tastes even better with a little extra savings."}</p></div><div className="cp-ticket-bottom"><span>USE CODE</span><strong>{form.code || "YOURCODE"}</strong><p>{Number(form.minimumBillAmount) > 0 ? "On orders of ₹" + Number(form.minimumBillAmount).toLocaleString("en-IN") + " or more" : "No minimum order"}</p></div></div><p className="cp-preview-note">A preview of your offer details. Visibility follows your schedule and status.</p></aside>
      </div>
      <div className="panel offer-table-panel"><div className="cp-library-heading"><div><h2>Your offers <span>{coupons.length}</span></h2><p>Manage every little reason to order again.</p></div><TicketPercent size={24} /></div><div className="offer-table-scroll"><table><thead><tr><th>Offer / code</th><th>Discount</th><th>Min order</th><th>Days</th><th>Usage</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={7}><SkeletonTable rows={4} columns={7} /></td></tr> : !coupons.length ? <tr><td colSpan={7}><div className="cp-empty"><TicketPercent size={36} /><h3>Your first offer starts here</h3><p>Create a coupon above and give your guests a reason to return.</p></div></td></tr> : coupons.map((coupon) => <tr key={coupon._id}>
          <td data-label="Offer"><strong>{coupon.title || coupon.code}</strong><small className="offer-table-code">{coupon.code}{coupon.showOnMenu ? " · On menu" : " · Code only"}</small></td>
          <td data-label="Discount">{coupon.discountType === "Percent" ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}</td><td>₹{coupon.minimumBillAmount || 0}</td>
          <td data-label="Available" className="cp-table-days">{(coupon.activeDays || days).length === 7 ? "Every day" : (coupon.activeDays || []).map((day) => days[day]).join(" · ")}</td><td data-label="Usage">{coupon.usedCount || 0} / {coupon.usageLimit || "Unlimited"}</td><td data-label="Status"><span className={"cp-status " + (coupon.status === "Active" ? "active" : "")}>{coupon.status}</span></td>
          <td data-label="Actions"><div className="offer-editor-actions"><button type="button" onClick={() => edit(coupon)}>Edit</button><button className="cp-delete" type="button" onClick={() => setDeleteTarget(coupon)}>Delete</button></div></td>
        </tr>)}
      </tbody></table></div></div>
      <DeleteConfirmModal open={!!deleteTarget} title={`Delete coupon ${deleteTarget?.code || ""}?`} message="Enter your login password to delete this coupon." onCancel={() => setDeleteTarget(null)} onConfirm={remove} />
    </div>
  );
}
