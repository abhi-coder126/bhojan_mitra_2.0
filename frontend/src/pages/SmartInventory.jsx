import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  History,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react";
import API from "../api/axios";
import { SkeletonTable } from "../components/Skeleton";
import AsyncButton from "../components/AsyncButton";
import { ToastViewport, useToast } from "../components/Toast";
import ConfirmActionModal from "../components/ConfirmActionModal";

// Smart Inventory = raw materials behind the menu:
//  - stock goes UP only through recorded purchases (priced at weighted average cost)
//  - stock goes DOWN automatically when a dish with a recipe is sold, and comes back
//    if that order is cancelled; wastage and physical counts are recorded explicitly
//  - every change lands in the stock ledger, so current stock can always be explained
//  - recipes turn ingredient prices into food cost % per dish
const UNITS = ["kg", "g", "litre", "ml", "pcs", "dozen", "pack"];
const TABS = [
  { key: "stock", label: "Stock" },
  { key: "recipes", label: "Recipes" },
  { key: "costing", label: "Food Cost" },
  { key: "ledger", label: "Stock Ledger" },
  { key: "alerts", label: "Reorder" },
];
const TYPE_LABELS = {
  opening: "Opening stock",
  purchase: "Purchase",
  consumption: "Used in orders",
  reversal: "Order cancelled",
  wastage: "Wastage",
  adjustment: "Count correction",
};

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qtyText = (value) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const errorText = (error, fallback) => error.response?.data?.message || error.message || fallback;

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="bm-overlay" role="presentation">
      <div className="bm-modal" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: 560 }}>
        <button type="button" className="bm-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {subtitle && <p className="bm-muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, full, children }) {
  return (
    <div className={`bm-field${full ? " bm-field-full" : ""}`}>
      <label>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

function MovementModal({ material, type, onClose, onSaved }) {
  const [form, setForm] = useState({ qty: "", unitCost: material.costPerUnit || "", reference: "", note: "" });
  const [error, setError] = useState("");
  const qty = Number(form.qty || 0);

  const preview =
    type === "purchase" ? material.stock + qty : type === "wastage" ? material.stock - qty : form.qty === "" ? null : qty;

  const titles = {
    purchase: `Record purchase - ${material.name}`,
    wastage: `Record wastage - ${material.name}`,
    count: `Physical count - ${material.name}`,
  };
  const subtitles = {
    purchase: "Stock received from a supplier. The average cost per unit is updated automatically.",
    wastage: "Spoiled, expired or spilled stock. It is removed and counted as wastage.",
    count: "Enter what you actually counted. The difference is recorded as a correction.",
  };

  const save = async () => {
    setError("");
    try {
      await API.post(`/raw-materials/${material._id}/movements`, { type, ...form });
      onSaved();
    } catch (cause) {
      setError(errorText(cause, "Could not save"));
    }
  };

  return (
    <Modal title={titles[type]} subtitle={subtitles[type]} onClose={onClose}>
      <div className="bm-grid" style={{ marginTop: 14 }}>
        <Field label={type === "count" ? `Counted stock (${material.unit}) *` : `Quantity (${material.unit}) *`}>
          <input
            type="number"
            min="0"
            step="any"
            autoFocus
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: e.target.value })}
          />
        </Field>
        {type === "purchase" && (
          <Field label={`Price per ${material.unit} *`}>
            <input
              type="number"
              min="0"
              step="any"
              value={form.unitCost}
              onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
            />
          </Field>
        )}
        {type === "purchase" && (
          <Field label="Supplier bill no.">
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </Field>
        )}
        <Field label={type === "wastage" ? "Reason *" : "Note"} full={type !== "purchase"}>
          <input
            value={form.note}
            placeholder={type === "wastage" ? "e.g. expired, spilled, burnt" : ""}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </Field>
      </div>

      {preview !== null && (
        <div className="bm-royalty-preview">
          Stock: {qtyText(material.stock)} → <b>{qtyText(preview)}</b> {material.unit}
          {type === "purchase" && qty > 0 && ` · purchase value ${money(qty * Number(form.unitCost || 0))}`}
        </div>
      )}
      {error && <div className="bm-error" role="alert">{error}</div>}

      <div className="bm-modal-footer">
        <button type="button" className="bm-btn" onClick={onClose}>
          Cancel
        </button>
        <AsyncButton className="bm-btn bm-btn-primary" onClick={save}>
          Save
        </AsyncButton>
      </div>
    </Modal>
  );
}

function MaterialModal({ material, onClose, onSaved }) {
  const isEdit = Boolean(material);
  const [form, setForm] = useState({
    name: material?.name || "",
    unit: material?.unit || "kg",
    stock: "",
    costPerUnit: material?.costPerUnit ?? "",
    lowStockThreshold: material?.lowStockThreshold ?? 5,
  });
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    try {
      if (isEdit) {
        await API.put(`/raw-materials/${material._id}`, {
          name: form.name,
          unit: form.unit,
          costPerUnit: form.costPerUnit,
          lowStockThreshold: form.lowStockThreshold,
        });
      } else {
        await API.post("/raw-materials", form);
      }
      onSaved(isEdit ? "Raw material updated" : "Raw material added");
    } catch (cause) {
      setError(errorText(cause, "Could not save raw material"));
    }
  };

  return (
    <Modal
      title={isEdit ? `Edit ${material.name}` : "Add raw material"}
      subtitle={isEdit ? "To change stock, use Purchase, Wastage or Count so it is recorded." : ""}
      onClose={onClose}
    >
      <div className="bm-grid" style={{ marginTop: 14 }}>
        <Field label="Name *">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Paneer" />
        </Field>
        <Field label="Unit *" hint="Recipes use this unit too">
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
        {!isEdit && (
          <Field label={`Opening stock (${form.unit})`}>
            <input type="number" min="0" step="any" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </Field>
        )}
        <Field label={`Cost per ${form.unit}`} hint={isEdit ? "Normally set automatically from purchases" : ""}>
          <input
            type="number"
            min="0"
            step="any"
            value={form.costPerUnit}
            onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
          />
        </Field>
        <Field label={`Reorder level (${form.unit})`} hint="Alert when stock falls to this level">
          <input
            type="number"
            min="0"
            step="any"
            value={form.lowStockThreshold}
            onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
          />
        </Field>
      </div>
      {error && <div className="bm-error" role="alert">{error}</div>}
      <div className="bm-modal-footer">
        <button type="button" className="bm-btn" onClick={onClose}>
          Cancel
        </button>
        <AsyncButton className="bm-btn bm-btn-primary" onClick={save}>
          {isEdit ? "Save changes" : "Add material"}
        </AsyncButton>
      </div>
    </Modal>
  );
}

function RecipeEditor({ products, materials, recipes, initialProductId, onSaved, onCancel }) {
  const recipeFor = (productId) => recipes.find((r) => String(r.productId) === String(productId));
  const rowsFor = (productId) => {
    const recipe = recipeFor(productId);
    return recipe
      ? recipe.items.map((i) => ({ rawMaterialId: String(i.rawMaterialId), qtyPerUnit: String(i.qtyPerUnit) }))
      : [{ rawMaterialId: "", qtyPerUnit: "" }];
  };

  const [productId, setProductId] = useState(initialProductId || "");
  const [rows, setRows] = useState(() => rowsFor(initialProductId));
  const [error, setError] = useState("");
  const materialMap = useMemo(() => new Map(materials.map((m) => [m._id, m])), [materials]);

  const pickProduct = (id) => {
    setProductId(id);
    setRows(rowsFor(id));
  };
  const setRow = (index, key, value) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  const portionCost = rows.reduce((sum, row) => {
    const m = materialMap.get(row.rawMaterialId);
    return sum + (m ? Number(row.qtyPerUnit || 0) * Number(m.costPerUnit || 0) : 0);
  }, 0);

  const save = async () => {
    setError("");
    try {
      await API.post("/recipes", { productId, items: rows.filter((r) => r.rawMaterialId) });
      onSaved();
    } catch (cause) {
      setError(errorText(cause, "Could not save recipe"));
    }
  };

  return (
    <div className="bm-card">
      <h2>{recipeFor(productId) ? "Edit recipe" : "New recipe"}</h2>
      <p className="bm-muted">Quantities are for ONE portion sold, in the ingredient's own unit (e.g. 0.15 kg paneer).</p>

      <div className="bm-field" style={{ marginTop: 12, maxWidth: 420 }}>
        <label>Menu item *</label>
        <select value={productId} onChange={(e) => pickProduct(e.target.value)}>
          <option value="">Select menu item</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
              {recipeFor(p._id) ? " (has recipe)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {rows.map((row, index) => {
          const m = materialMap.get(row.rawMaterialId);
          return (
            <div key={index} className="inv-recipe-row">
              <select value={row.rawMaterialId} onChange={(e) => setRow(index, "rawMaterialId", e.target.value)}>
                <option value="">Select ingredient</option>
                {materials.map((mat) => (
                  <option key={mat._id} value={mat._id}>
                    {mat.name} ({mat.unit})
                  </option>
                ))}
              </select>
              <div className="inv-qty-input">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Qty per portion"
                  value={row.qtyPerUnit}
                  onChange={(e) => setRow(index, "qtyPerUnit", e.target.value)}
                />
                <span>{m?.unit || ""}</span>
              </div>
              <span className="bm-muted inv-row-cost">
                {m ? money(Number(row.qtyPerUnit || 0) * Number(m.costPerUnit || 0)) : ""}
              </span>
              <button
                type="button"
                className="bm-btn bm-btn-sm bm-btn-danger"
                aria-label="Remove ingredient"
                disabled={rows.length === 1}
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="bm-toolbar" style={{ marginTop: 12, justifyContent: "space-between" }}>
        <button type="button" className="bm-btn bm-btn-sm" onClick={() => setRows([...rows, { rawMaterialId: "", qtyPerUnit: "" }])}>
          <Plus size={14} /> Add ingredient
        </button>
        <b>Cost per portion: {money(portionCost)}</b>
      </div>

      {error && <div className="bm-error" role="alert">{error}</div>}
      <div className="bm-modal-footer">
        {onCancel && (
          <button type="button" className="bm-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        <AsyncButton className="bm-btn bm-btn-primary" disabled={!productId} onClick={save}>
          Save recipe
        </AsyncButton>
      </div>
    </div>
  );
}

export default function SmartInventory() {
  const [tab, setTab] = useState("stock");
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [foodCosts, setFoodCosts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [ledgerFilter, setLedgerFilter] = useState({ materialId: "", type: "", from: "", to: "" });
  const [modal, setModal] = useState(null);
  // Destructive actions go through the app's own dialog rather than window.confirm,
  // which cannot be styled and looks nothing like the rest of the product.
  const [confirm, setConfirm] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null); // productId or "" for new
  const { toast, showToast } = useToast();

  const fetchAll = useCallback(async () => {
    try {
      const [materialsRes, productsRes, recipesRes, foodCostRes, summaryRes] = await Promise.all([
        API.get("/raw-materials"),
        API.get("/products").catch(() => ({ data: { products: [] } })),
        API.get("/recipes"),
        API.get("/recipes/food-cost"),
        API.get("/raw-materials/summary"),
      ]);
      setMaterials(materialsRes.data.materials || []);
      setProducts(productsRes.data.products || []);
      setRecipes(recipesRes.data.recipes || []);
      setFoodCosts(foodCostRes.data.foodCosts || []);
      setSummary(summaryRes.data.summary);
    } catch (error) {
      showToast(errorText(error, "Could not load inventory"), "warning");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchLedger = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries(ledgerFilter).filter(([, value]) => value));
      const res = await API.get("/raw-materials/ledger", { params });
      setLedger(res.data.entries || []);
    } catch (error) {
      showToast(errorText(error, "Could not load the stock ledger"), "warning");
    }
  }, [ledgerFilter, showToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (tab === "ledger") fetchLedger();
  }, [tab, fetchLedger]);

  const done = (message) => {
    setModal(null);
    if (message) showToast(message, "success");
    fetchAll();
    if (tab === "ledger") fetchLedger();
  };

  const removeMaterial = (material) =>
    setConfirm({
      title: `Delete ${material.name}?`,
      message: "Its stock history stays in the ledger. This cannot be undone.",
      confirmText: "Delete material",
      run: async () => {
        await API.delete(`/raw-materials/${material._id}`);
        done("Raw material deleted");
      },
      failure: "Could not delete",
    });

  const removeRecipe = (recipe) =>
    setConfirm({
      title: `Delete the recipe for ${recipe.productName}?`,
      message: "Its ingredients will stop being deducted from stock when this dish is sold.",
      confirmText: "Delete recipe",
      run: async () => {
        await API.delete(`/recipes/${recipe._id}`);
        done("Recipe deleted");
      },
      failure: "Could not delete recipe",
    });

  const showHistory = (material) => {
    setLedgerFilter({ materialId: material._id, type: "", from: "", to: "" });
    setTab("ledger");
  };

  const reorderList = materials.filter((m) => Number(m.stock) <= Number(m.lowStockThreshold));
  const stockState = (m) => (m.stock <= 0 ? "out" : m.stock <= m.lowStockThreshold ? "low" : "ok");
  const recipeProductIds = new Set(recipes.map((r) => String(r.productId)));
  const productsWithoutRecipe = products.filter((p) => !recipeProductIds.has(String(p._id))).length;

  return (
    <div className="bm-page">
      <ToastViewport toast={toast} />

      <div className="bm-head">
        <div>
          <h1>Smart Inventory</h1>
          <p>
            Raw material stock that updates itself from orders, with purchases, wastage, counts and food cost per dish.
          </p>
        </div>
        <button type="button" className="bm-btn bm-btn-primary" onClick={() => setModal({ type: "material" })}>
          <Plus size={16} /> Add raw material
        </button>
      </div>

      {summary && (
        <div className="bm-kpis">
          <div className="bm-kpi">
            <span>Stock value</span>
            <strong>{money(summary.stockValue)}</strong>
            <small>{summary.materials} raw materials</small>
          </div>
          <div className={`bm-kpi${summary.lowStock + summary.outOfStock > 0 ? " bm-kpi-accent" : ""}`}>
            <span>Need reorder</span>
            <strong>{summary.lowStock + summary.outOfStock}</strong>
            <small>
              {summary.outOfStock} out · {summary.lowStock} low
            </small>
          </div>
          <div className="bm-kpi">
            <span>Purchased (30 days)</span>
            <strong>{money(summary.last30Days.purchased)}</strong>
          </div>
          <div className="bm-kpi">
            <span>Used in orders (30 days)</span>
            <strong>{money(summary.last30Days.consumed)}</strong>
          </div>
          <div className="bm-kpi">
            <span>Wastage (30 days)</span>
            <strong>{money(summary.last30Days.wasted)}</strong>
          </div>
        </div>
      )}

      <div className="bm-segmented" role="tablist" aria-label="Inventory sections" style={{ width: "fit-content" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "alerts" && reorderList.length > 0 ? ` (${reorderList.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <div className="bm-card">
          {loading ? (
            <SkeletonTable rows={6} columns={6} />
          ) : materials.length === 0 ? (
            <div className="bm-empty">Add your raw materials (paneer, oil, flour...) to start tracking stock.</div>
          ) : (
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="num">In stock</th>
                    <th className="num">Avg cost</th>
                    <th className="num">Stock value</th>
                    <th className="num">Reorder at</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => {
                    const state = stockState(m);
                    return (
                      <tr key={m._id}>
                        <td>
                          <span className="bm-branch-name">{m.name}</span>
                          {state !== "ok" && (
                            <span className={`bm-status ${state === "out" ? "bm-status-archived" : "bm-status-hold"}`} style={{ marginLeft: 8 }}>
                              {state === "out" ? "out of stock" : "low"}
                            </span>
                          )}
                        </td>
                        <td className="num" style={{ color: m.stock < 0 ? "#b91c1c" : undefined }}>
                          <b>{qtyText(m.stock)}</b> {m.unit}
                          {m.stock < 0 && <div className="bm-muted">record missing purchases</div>}
                        </td>
                        <td className="num">
                          {money(m.costPerUnit)}/{m.unit}
                        </td>
                        <td className="num">{money(Math.max(m.stock, 0) * m.costPerUnit)}</td>
                        <td className="num">
                          {qtyText(m.lowStockThreshold)} {m.unit}
                        </td>
                        <td>
                          <div className="bm-actions">
                            <button type="button" className="bm-btn bm-btn-sm" onClick={() => setModal({ type: "purchase", material: m })}>
                              <PackagePlus size={14} /> Purchase
                            </button>
                            <button type="button" className="bm-btn bm-btn-sm" onClick={() => setModal({ type: "wastage", material: m })}>
                              <TrendingDown size={14} /> Wastage
                            </button>
                            <button type="button" className="bm-btn bm-btn-sm" onClick={() => setModal({ type: "count", material: m })}>
                              <ClipboardCheck size={14} /> Count
                            </button>
                            <button type="button" className="bm-btn bm-btn-sm" onClick={() => showHistory(m)}>
                              <History size={14} /> History
                            </button>
                            <button type="button" className="bm-btn bm-btn-sm" onClick={() => setModal({ type: "material", material: m })}>
                              <Pencil size={14} />
                            </button>
                            <button type="button" className="bm-btn bm-btn-sm bm-btn-danger" aria-label={`Delete ${m.name}`} onClick={() => removeMaterial(m)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "recipes" && (
        <>
          {productsWithoutRecipe > 0 && (
            <div className="bm-notice">
              <AlertTriangle size={18} />
              <span>
                {productsWithoutRecipe} menu item{productsWithoutRecipe === 1 ? "" : "s"} have no recipe, so selling them
                doesn't reduce any raw material stock.
              </span>
            </div>
          )}

          {editingRecipe !== null ? (
            <RecipeEditor
              key={editingRecipe || "new"}
              products={products}
              materials={materials}
              recipes={recipes}
              initialProductId={editingRecipe}
              onCancel={() => setEditingRecipe(null)}
              onSaved={() => {
                setEditingRecipe(null);
                done("Recipe saved");
              }}
            />
          ) : (
            <div>
              <button type="button" className="bm-btn bm-btn-primary" onClick={() => setEditingRecipe("")}>
                <Plus size={16} /> New recipe
              </button>
            </div>
          )}

          <div className="bm-card">
            {recipes.length === 0 ? (
              <div className="bm-empty">No recipes yet.</div>
            ) : (
              <div className="bm-table-wrap">
                <table className="bm-table" style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th>Menu item</th>
                      <th>Ingredients per portion</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipes.map((r) => (
                      <tr key={r._id}>
                        <td className="bm-branch-name">{r.productName}</td>
                        <td>{r.items.map((i) => `${qtyText(i.qtyPerUnit)} ${i.unit} ${i.rawMaterialName}`).join(", ")}</td>
                        <td>
                          <div className="bm-actions">
                            <button type="button" className="bm-btn bm-btn-sm" onClick={() => setEditingRecipe(String(r.productId))}>
                              <Pencil size={14} /> Edit
                            </button>
                            <button type="button" className="bm-btn bm-btn-sm bm-btn-danger" onClick={() => removeRecipe(r)}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "costing" && (
        <div className="bm-card">
          <p className="bm-muted" style={{ marginTop: 0 }}>
            Food cost % = ingredient cost ÷ selling price excluding GST. Most restaurants aim for 25-35%.
          </p>
          {foodCosts.length === 0 ? (
            <div className="bm-empty">Add recipes to see food cost per dish.</div>
          ) : (
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Dish</th>
                    <th className="num">Menu price</th>
                    <th className="num">Price excl. GST</th>
                    <th className="num">Ingredient cost</th>
                    <th className="num">Food cost %</th>
                    <th className="num">Margin</th>
                    <th className="num">Can make now</th>
                  </tr>
                </thead>
                <tbody>
                  {foodCosts.map((f) => (
                    <tr key={f.productId}>
                      <td>
                        <span className="bm-branch-name">{f.productName}</span>
                        <div className="bm-muted">
                          {f.ingredients.map((i) => `${qtyText(i.qty)} ${i.unit} ${i.name} (${money(i.cost)})`).join(", ")}
                        </div>
                      </td>
                      <td className="num">{money(f.priceInclGst)}</td>
                      <td className="num">{money(f.sellingPrice)}</td>
                      <td className="num">{money(f.ingredientCost)}</td>
                      <td className="num">
                        <span
                          className={`bm-status ${
                            f.foodCostPercent > 35 ? "bm-status-archived" : f.foodCostPercent > 30 ? "bm-status-hold" : "bm-status-active"
                          }`}
                          style={f.foodCostPercent > 35 ? { background: "#fee2e2", color: "#b91c1c" } : undefined}
                        >
                          {f.foodCostPercent}%
                        </span>
                      </td>
                      <td className="num">{money(f.grossMargin)}</td>
                      <td className="num">
                        <b>{f.portionsPossible}</b>
                        {f.limitingIngredient && <div className="bm-muted">limited by {f.limitingIngredient}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "ledger" && (
        <div className="bm-card">
          <div className="bm-toolbar" style={{ marginBottom: 12 }}>
            <select
              value={ledgerFilter.materialId}
              onChange={(e) => setLedgerFilter({ ...ledgerFilter, materialId: e.target.value })}
              aria-label="Material"
            >
              <option value="">All materials</option>
              {materials.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select value={ledgerFilter.type} onChange={(e) => setLedgerFilter({ ...ledgerFilter, type: e.target.value })} aria-label="Type">
              <option value="">All movements</option>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <input type="date" aria-label="From" value={ledgerFilter.from} onChange={(e) => setLedgerFilter({ ...ledgerFilter, from: e.target.value })} />
            <input type="date" aria-label="To" value={ledgerFilter.to} onChange={(e) => setLedgerFilter({ ...ledgerFilter, to: e.target.value })} />
          </div>

          {ledger.length === 0 ? (
            <div className="bm-empty">No stock movements for this filter.</div>
          ) : (
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Material</th>
                    <th>Movement</th>
                    <th className="num">Qty</th>
                    <th className="num">Stock after</th>
                    <th className="num">Value</th>
                    <th>Reference / note</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => (
                    <tr key={entry._id}>
                      <td>{new Date(entry.createdAt).toLocaleString("en-IN")}</td>
                      <td>{entry.materialName}</td>
                      <td>{TYPE_LABELS[entry.type] || entry.type}</td>
                      <td className="num" style={{ color: entry.qty < 0 ? "#b91c1c" : "#15803d" }}>
                        {entry.qty > 0 ? "+" : ""}
                        {qtyText(entry.qty)} {entry.unit}
                      </td>
                      <td className="num">
                        {qtyText(entry.stockAfter)} {entry.unit}
                      </td>
                      <td className="num">{money(entry.value)}</td>
                      <td>{[entry.reference, entry.note].filter(Boolean).join(" · ") || "-"}</td>
                      <td>{entry.actor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "alerts" && (
        <div className="bm-card">
          {reorderList.length === 0 ? (
            <div className="bm-empty">Everything is above its reorder level.</div>
          ) : (
            <>
            <div className="bm-reorder-head">
              <AlertTriangle size={17} />
              <p>
                <b>{reorderList.length} {reorderList.length === 1 ? "material needs" : "materials need"} restocking.</b>{" "}
                {reorderList.filter((m) => Number(m.stock) <= 0).length} out of stock.
              </p>
            </div>
            <div className="bm-table-wrap">
              <table className="bm-table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="num">In stock</th>
                    <th className="num">Reorder at</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reorderList.map((m) => {
                    const out = Number(m.stock) <= 0;
                    // How much to buy to get back to the reorder level.
                    const shortfall = Math.max(0, Number(m.lowStockThreshold) - Number(m.stock));
                    return (
                      <tr key={m._id}>
                        <td>
                          <div className="bm-reorder-name">
                            <span className="bm-branch-name">{m.name}</span>
                            <span className={`bm-status ${out ? "bm-status-archived" : "bm-status-hold"}`}>
                              {out ? "Out of stock" : "Low"}
                            </span>
                          </div>
                        </td>
                        <td className="num">
                          <b className={`bm-reorder-stock ${out ? "out" : "low"}`}>{qtyText(m.stock)} {m.unit}</b>
                          {shortfall > 0 && <small className="bm-reorder-short">Short by {qtyText(shortfall)} {m.unit}</small>}
                        </td>
                        <td className="num">
                          {qtyText(m.lowStockThreshold)} {m.unit}
                        </td>
                        <td>
                          <button type="button" className="bm-btn bm-btn-sm bm-btn-primary" onClick={() => setModal({ type: "purchase", material: m })}>
                            <PackagePlus size={14} /> Record purchase
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      <ConfirmActionModal
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.confirmText}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            await confirm.run();
          } catch (error) {
            showToast(errorText(error, confirm.failure), "error");
          } finally {
            setConfirm(null);
          }
        }}
      />

      {modal?.type === "material" && <MaterialModal material={modal.material} onClose={() => setModal(null)} onSaved={done} />}
      {["purchase", "wastage", "count"].includes(modal?.type) && (
        <MovementModal
          material={modal.material}
          type={modal.type}
          onClose={() => setModal(null)}
          onSaved={() => done({ purchase: "Purchase recorded", wastage: "Wastage recorded", count: "Stock count saved" }[modal.type])}
        />
      )}
    </div>
  );
}
