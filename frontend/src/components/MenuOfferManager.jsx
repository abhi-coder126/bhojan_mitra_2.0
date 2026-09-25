import { useCallback, useEffect, useState } from "react";
import { BadgePercent, Gift, Pencil, Plus, Trash2, X } from "lucide-react";
import API from "../api/axios";
import ConfirmActionModal from "./ConfirmActionModal";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const emptyOffer = {
  title: "",
  type: "bogo",
  productId: "",
  variantIds: [],
  minOrderAmount: "",
  freeProductId: "",
  freeVariantId: "",
  activeDays: ALL_DAYS,
  status: "Active",
};

// Item offers ("Buy 1 Get 1 Free on Medium and Large", "Free cold drink with any
// pizza") sit apart from coupons, which discount the whole bill.
export default function MenuOfferManager({ products, onClose, showToast }) {
  const [offers, setOffers] = useState([]);
  const [form, setForm] = useState(emptyOffer);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    const res = await API.get("/menu-offers");
    setOffers(res.data.offers || []);
  }, []);

  useEffect(() => {
    load()
      .catch((cause) => showToast(cause.response?.data?.message || "Could not load offers", "error"))
      .finally(() => setLoading(false));
  }, [load, showToast]);

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const product = products.find((row) => row._id === form.productId);
  const freeProduct = products.find((row) => row._id === form.freeProductId);
  const sizes = product?.variants || [];

  const reset = () => {
    setForm(emptyOffer);
    setEditingId(null);
    setError("");
  };

  const toggle = (field, value) =>
    setForm((current) => {
      const list = current[field];
      return {
        ...current,
        [field]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
    });

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!form.title.trim()) return setError("Give the offer a title customers will understand");
    if (!form.productId) return setError("Choose the item this offer is on");
    if (form.type === "combo" && !form.freeProductId) return setError("Choose the free item");
    if (!form.activeDays.length) return setError("Pick at least one day");

    setBusy(true);
    setError("");
    try {
      if (editingId) await API.put(`/menu-offers/${editingId}`, form);
      else await API.post("/menu-offers", form);
      showToast(editingId ? "Offer updated" : "Offer added", "success");
      reset();
      await load();
    } catch (cause) {
      setError(cause.response?.data?.message || "Could not save this offer");
    } finally {
      setBusy(false);
    }
  };

  const edit = (offer) => {
    setEditingId(offer._id);
    setError("");
    setForm({
      title: offer.title,
      type: offer.type,
      productId: String(offer.productId),
      variantIds: offer.variantIds || [],
      minOrderAmount: offer.minOrderAmount || "",
      freeProductId: offer.freeProductId ? String(offer.freeProductId) : "",
      freeVariantId: offer.freeVariantId || "",
      activeDays: offer.activeDays || ALL_DAYS,
      status: offer.status,
    });
  };

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal-card large offer-manager" role="dialog" aria-modal="true" aria-label="Item offers">
        <div className="modal-head">
          <h2>Item Offers</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close" title="Close">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <form className="offer-form" onSubmit={submit}>
          <input
            placeholder="Offer title, e.g. Buy 1 Get 1 Free"
            maxLength={80}
            value={form.title}
            onChange={(event) => change("title", event.target.value)}
            required
          />

          <div className="offer-type-row">
            <button
              type="button"
              className={form.type === "bogo" ? "active" : ""}
              onClick={() => change("type", "bogo")}
            >
              <Gift size={15} /> Buy 1 Get 1 Free
            </button>
            <button
              type="button"
              className={form.type === "combo" ? "active" : ""}
              onClick={() => change("type", "combo")}
            >
              <BadgePercent size={15} /> Free item with this
            </button>
          </div>

          <label className="offer-field">
            <span>{form.type === "bogo" ? "Buy this item" : "When the customer buys"}</span>
            <select
              value={form.productId}
              onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value, variantIds: [] }))}
              required
            >
              <option value="">Select a menu item</option>
              {products.map((row) => (
                <option key={row._id} value={row._id}>{row.name}</option>
              ))}
            </select>
          </label>

          {sizes.length > 0 && (
            <fieldset className="offer-sizes">
              <legend>Which sizes? <small>Leave all unticked for every size</small></legend>
              <div>
                {sizes.map((variant) => (
                  <label key={variant.id}>
                    <input
                      type="checkbox"
                      checked={form.variantIds.includes(variant.id)}
                      onChange={() => toggle("variantIds", variant.id)}
                    />
                    {variant.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {form.type === "combo" && (
            <>
              <label className="offer-field">
                <span>They get this free</span>
                <select
                  value={form.freeProductId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, freeProductId: event.target.value, freeVariantId: "" }))
                  }
                  required
                >
                  <option value="">Select the free item</option>
                  {products.map((row) => (
                    <option key={row._id} value={row._id}>{row.name}</option>
                  ))}
                </select>
              </label>

              {(freeProduct?.variants || []).length > 0 && (
                <label className="offer-field">
                  <span>Free item size</span>
                  <select value={form.freeVariantId} onChange={(event) => change("freeVariantId", event.target.value)}>
                    <option value="">Any / not applicable</option>
                    {freeProduct.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>{variant.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          <label className="offer-field">
            <span>Minimum order amount <small>Leave blank for no minimum</small></span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 499"
              value={form.minOrderAmount}
              onChange={(event) => change("minOrderAmount", event.target.value)}
            />
          </label>

          <fieldset className="offer-days">
            <legend>Runs on <small>India time</small></legend>
            <div>
              {DAYS.map((day, index) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={form.activeDays.includes(index)}
                    onChange={() => toggle("activeDays", index)}
                  />
                  {day}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="offer-form-actions">
            <label className="offer-status">
              <input
                type="checkbox"
                checked={form.status === "Active"}
                onChange={(event) => change("status", event.target.checked ? "Active" : "Inactive")}
              />
              Active
            </label>
            {editingId && (
              <button type="button" onClick={reset}>Cancel edit</button>
            )}
            <button type="submit" className="add-product-main-btn" disabled={busy}>
              <Plus size={15} /> {editingId ? "Save offer" : "Add offer"}
            </button>
          </div>

          {error && <p className="async-form-error" role="alert">{error}</p>}
        </form>

        {loading ? (
          <p className="bm-empty">Loading offers...</p>
        ) : offers.length === 0 ? (
          <p className="bm-empty">No item offers yet. Create the first one above.</p>
        ) : (
          <ul className="offer-list">
            {offers.map((offer) => (
              <li key={offer._id}>
                <span className="offer-list-icon">
                  {offer.type === "bogo" ? <Gift size={18} /> : <BadgePercent size={18} />}
                </span>
                <span className="offer-list-body">
                  <b>{offer.title}</b>
                  <small>
                    {offer.type === "bogo"
                      ? `Buy 1 get 1 free on ${offer.productName}`
                      : `Free ${offer.freeSizeLabel ? `${offer.freeProductName} (${offer.freeSizeLabel})` : offer.freeProductName} with ${offer.productName}`}
                    {offer.sizeLabels.length > 0 && ` · ${offer.sizeLabels.join(", ")} only`}
                    {offer.minOrderAmount > 0 && ` · on bills over ₹${offer.minOrderAmount}`}
                  </small>
                  <small className="offer-list-days">
                    {offer.activeDays.length === 7 ? "Every day" : offer.activeDays.map((day) => DAYS[day]).join(", ")}
                    {offer.status !== "Active" ? " · Paused" : offer.runsToday ? " · Running today" : " · Not today"}
                  </small>
                </span>
                <span className="row-actions">
                  <button type="button" className="bm-btn bm-btn-sm" onClick={() => edit(offer)}>
                    <Pencil size={14} /> Edit
                  </button>
                  <button type="button" className="bm-btn bm-btn-sm" title="Delete" onClick={() => setConfirm(offer)}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <ConfirmActionModal
          open={Boolean(confirm)}
          title={`Delete "${confirm?.title}"?`}
          message="Customers stop seeing this offer straight away. Orders already placed are not affected."
          confirmText="Delete offer"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              await API.delete(`/menu-offers/${confirm._id}`);
              showToast("Offer deleted", "success");
              await load();
            } catch (cause) {
              showToast(cause.response?.data?.message || "Could not delete", "error");
            } finally {
              setConfirm(null);
            }
          }}
        />
      </div>
    </div>
  );
}
