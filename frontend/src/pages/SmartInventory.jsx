import { useEffect, useState } from "react";
import API from "../api/axios";
import { ToastViewport, useToast } from "../components/Toast";

const units = ["kg", "g", "litre", "ml", "pcs", "dozen", "pack"];

export default function SmartInventory() {
  const [tab, setTab] = useState("materials");
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [foodCosts, setFoodCosts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const { toast, showToast } = useToast();

  const [materialForm, setMaterialForm] = useState({ name: "", unit: "kg", stock: 0, costPerUnit: 0, lowStockThreshold: 5 });
  const [recipeProductId, setRecipeProductId] = useState("");
  const [recipeItems, setRecipeItems] = useState([{ rawMaterialId: "", qtyPerUnit: "" }]);

  const fetchAll = async () => {
    try {
      const [materialsRes, productsRes, recipesRes, foodCostRes, lowStockRes] = await Promise.all([
        API.get("/raw-materials"),
        API.get("/products").catch(() => ({ data: { products: [] } })),
        API.get("/recipes"),
        API.get("/recipes/food-cost"),
        API.get("/raw-materials/alerts/low-stock"),
      ]);
      setMaterials(materialsRes.data.materials || []);
      setProducts(productsRes.data.products || []);
      setRecipes(recipesRes.data.recipes || []);
      setFoodCosts(foodCostRes.data.foodCosts || []);
      setLowStock(lowStockRes.data.lowStock || []);
    } catch (error) {
      showToast(error.response?.data?.message || "Could not load inventory data", "warning");
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const addMaterial = async (e) => {
    e.preventDefault();
    try {
      await API.post("/raw-materials", materialForm);
      setMaterialForm({ name: "", unit: "kg", stock: 0, costPerUnit: 0, lowStockThreshold: 5 });
      showToast("Raw material added", "success");
      fetchAll();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not add raw material", "error");
    }
  };

  const deleteMaterial = async (id) => {
    try {
      await API.delete(`/raw-materials/${id}`);
      fetchAll();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not delete", "error");
    }
  };

  const adjustStock = async (id, qty, mode) => {
    try {
      await API.patch(`/raw-materials/${id}/adjust`, { qty, mode });
      fetchAll();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not adjust stock", "error");
    }
  };

  const updateRecipeItem = (idx, field, value) => {
    setRecipeItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const saveRecipe = async (e) => {
    e.preventDefault();
    if (!recipeProductId) {
      showToast("Select a product", "error");
      return;
    }
    try {
      await API.post("/recipes", {
        productId: recipeProductId,
        items: recipeItems.filter((i) => i.rawMaterialId && i.qtyPerUnit),
      });
      showToast("Recipe saved", "success");
      setRecipeProductId("");
      setRecipeItems([{ rawMaterialId: "", qtyPerUnit: "" }]);
      fetchAll();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not save recipe", "error");
    }
  };

  return (
    <div>
      <ToastViewport toast={toast} />

      <div className="page-head">
        <div>
          <h1>Smart Inventory & Recipe Costing</h1>
          <p>Track raw materials, link recipes to menu items and monitor food cost %.</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        {[
          ["materials", "Raw Materials"],
          ["recipes", "Recipes"],
          ["costing", "Food Cost"],
          ["alerts", `Low Stock (${lowStock.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ fontWeight: tab === key ? 700 : 400, opacity: tab === key ? 1 : 0.6 }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "materials" && (
        <>
          <form className="panel form-grid" onSubmit={addMaterial}>
            <input placeholder="Material name" value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} required />
            <select value={materialForm.unit} onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" placeholder="Opening stock" value={materialForm.stock} onChange={(e) => setMaterialForm({ ...materialForm, stock: e.target.value })} />
            <input type="number" placeholder="Cost per unit" value={materialForm.costPerUnit} onChange={(e) => setMaterialForm({ ...materialForm, costPerUnit: e.target.value })} />
            <input type="number" placeholder="Low stock threshold" value={materialForm.lowStockThreshold} onChange={(e) => setMaterialForm({ ...materialForm, lowStockThreshold: e.target.value })} />
            <button>Add Raw Material</button>
          </form>

          <div className="panel">
            <table>
              <thead>
                <tr><th>Name</th><th>Unit</th><th>Stock</th><th>Cost/Unit</th><th>Threshold</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m._id} style={{ background: m.stock <= m.lowStockThreshold ? "#fef2f2" : "transparent" }}>
                    <td>{m.name}</td>
                    <td>{m.unit}</td>
                    <td>{m.stock}</td>
                    <td>₹{m.costPerUnit}</td>
                    <td>{m.lowStockThreshold}</td>
                    <td>
                      <button style={{ fontSize: 11 }} onClick={() => adjustStock(m._id, 1, "add")}>+1</button>{" "}
                      <button style={{ fontSize: 11 }} onClick={() => adjustStock(m._id, 1, "reduce")}>-1</button>{" "}
                      <button style={{ fontSize: 11 }} onClick={() => deleteMaterial(m._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "recipes" && (
        <>
          <form className="panel" onSubmit={saveRecipe}>
            <select value={recipeProductId} onChange={(e) => setRecipeProductId(e.target.value)} required style={{ marginBottom: 10 }}>
              <option value="">Select menu item</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>

            {recipeItems.map((item, idx) => (
              <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <select value={item.rawMaterialId} onChange={(e) => updateRecipeItem(idx, "rawMaterialId", e.target.value)}>
                  <option value="">Select raw material</option>
                  {materials.map((m) => <option key={m._id} value={m._id}>{m.name} ({m.unit})</option>)}
                </select>
                <input
                  type="number"
                  placeholder="Qty per unit sold"
                  value={item.qtyPerUnit}
                  onChange={(e) => updateRecipeItem(idx, "qtyPerUnit", e.target.value)}
                />
              </div>
            ))}

            <button type="button" onClick={() => setRecipeItems([...recipeItems, { rawMaterialId: "", qtyPerUnit: "" }])}>
              + Add Ingredient
            </button>{" "}
            <button type="submit">Save Recipe</button>
          </form>

          <div className="panel">
            <table>
              <thead><tr><th>Menu Item</th><th>Ingredients</th></tr></thead>
              <tbody>
                {recipes.map((r) => (
                  <tr key={r._id}>
                    <td>{r.productName}</td>
                    <td>{r.items.map((i) => `${i.qtyPerUnit} ${i.unit} ${i.rawMaterialName}`).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "costing" && (
        <div className="panel">
          <table>
            <thead>
              <tr><th>Menu Item</th><th>Ingredient Cost</th><th>Selling Price</th><th>Food Cost %</th><th>Gross Margin</th></tr>
            </thead>
            <tbody>
              {foodCosts.map((f) => (
                <tr key={f.productId} style={{ background: f.foodCostPercent > 35 ? "#fef2f2" : "transparent" }}>
                  <td>{f.productName}</td>
                  <td>₹{f.ingredientCost}</td>
                  <td>₹{f.sellingPrice}</td>
                  <td>{f.foodCostPercent}%</td>
                  <td>₹{f.grossMargin}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {foodCosts.length === 0 && <p>Add recipes to see food cost analysis.</p>}
        </div>
      )}

      {tab === "alerts" && (
        <div className="panel">
          <table>
            <thead><tr><th>Material</th><th>Stock</th><th>Threshold</th><th>Unit</th></tr></thead>
            <tbody>
              {lowStock.map((m) => (
                <tr key={m._id}>
                  <td>{m.name}</td><td>{m.stock}</td><td>{m.lowStockThreshold}</td><td>{m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lowStock.length === 0 && <p>No low stock alerts.</p>}
        </div>
      )}
    </div>
  );
}
