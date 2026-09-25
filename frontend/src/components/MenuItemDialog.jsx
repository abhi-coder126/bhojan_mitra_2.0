import { useEffect, useRef, useState } from "react";
import { X, Utensils } from "lucide-react";
import { hasProductImage, productImageSrc } from "../api/productImage";

export default function MenuItemDialog({ product, onClose, onAdd }) {
  const [variantId, setVariantId] = useState(product.variants?.[0]?.id || "");
  const [addonIds, setAddonIds] = useState([]);
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current.showModal();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const variants = product.variants || [];
  const groups = product.optionGroups || [];
  const variant = variants.find((v) => v.id === variantId);
  const addons = groups.flatMap((g) => g.options).filter((o) => addonIds.includes(o.id));
  const basePrice = Number(variant?.price ?? (product.mrp || product.sellingPrice || 0));
  const rate = Math.round((Math.round(basePrice * (1 - Math.min(100, Math.max(0, Number(product.offerPercent || 0))) / 100) * 100) / 100 + addons.reduce((sum, o) => sum + Number(o.price), 0)) * 100) / 100;
  const valid = groups.every((g) => !g.required || g.options.some((o) => addonIds.includes(o.id)));
  const custom = variants.length > 0 || groups.length > 0;
  return <dialog ref={dialog} className={`menu-detail-dialog ${custom ? "has-options" : ""}`} aria-labelledby="menu-detail-title" onCancel={onClose} onClick={(e) => { if (e.target === dialog.current) onClose(); }}>
    <div className="menu-detail-layout">
      <button className="menu-detail-close" onClick={onClose} aria-label="Close item details"><X size={22} /></button>
      <section className="menu-detail-summary">
        <div className="menu-detail-image">{hasProductImage(product) ? <img src={productImageSrc(product)} alt={product.name} /> : <Utensils size={72} />}</div>
        <div className="menu-detail-copy">
          <span className={`menu-diet ${product.foodType === "non-veg" ? "nonveg" : ""}`}>{product.foodType === "non-veg" ? "Non-vegetarian" : "Vegetarian"}</span>
          <p className="menu-detail-category">{product.category}</p>
          <h2 id="menu-detail-title">{product.name}</h2>
          {Number(product.ratingCount) > 0 && <p className="menu-detail-rating">★ {Number(product.ratingAvg).toFixed(1)} · {product.ratingCount} ratings</p>}
          <strong>{variants.length ? "Starts from " : ""}₹{(variants.length ? Math.min(...variants.map((v) => v.price)) : basePrice).toFixed(2)}</strong>
          <p>{product.description || "Freshly prepared for you."}</p>
        </div>
      </section>
      {custom && <section className="menu-detail-options" aria-label="Customize your item">
        <p className="menu-detail-category">MADE YOUR WAY</p><h2>Customize your order</h2>
        {variants.length > 0 && <fieldset><legend>{product.itemType === "beverage" ? "Choose your volume" : "Choose your size"} <small>REQUIRED</small></legend><p>Select one option</p>{variants.map((v) => <label className="menu-choice" key={v.id}><span>{v.label}<b>₹{Number(v.price).toFixed(2)}</b></span><input type="radio" name="item-size" checked={variantId === v.id} onChange={() => setVariantId(v.id)} /></label>)}</fieldset>}
        {groups.map((g) => {
          const count = g.options.filter((o) => addonIds.includes(o.id)).length;
          return <fieldset key={g.id}><legend>{g.name} <small>{g.required ? "REQUIRED" : "OPTIONAL"}</small></legend><p>Choose {g.required ? "at least 1, " : ""}up to {g.maxSelections}</p>{g.options.map((o) => <label className="menu-choice" key={o.id}><span><i className={`menu-option-dot ${o.foodType === "non-veg" ? "nonveg" : ""}`} />{o.name}<b>+₹{Number(o.price).toFixed(2)}</b></span><input type="checkbox" checked={addonIds.includes(o.id)} disabled={!addonIds.includes(o.id) && count >= g.maxSelections} onChange={(e) => setAddonIds(e.target.checked ? [...addonIds, o.id] : addonIds.filter((id) => id !== o.id))} /></label>)}</fieldset>;
        })}
      </section>}
      <footer className="menu-detail-footer"><button disabled={!valid} onClick={() => onAdd({ variantId, addonIds, basePrice, rate, name: [product.name, variant?.label, ...addons.map((o) => o.name)].filter(Boolean).join(" · ") })}><strong>₹{rate.toFixed(2)}</strong><span>{valid ? "Add to cart +" : "Select required options"}</span></button></footer>
    </div>
  </dialog>;
}
