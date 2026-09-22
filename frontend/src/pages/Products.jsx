import { useEffect, useMemo, useState } from "react";
import { Eye, Flame, ImagePlus, Leaf, Pencil, Sparkles, Trash2, Utensils } from "lucide-react";
import API from "../api/axios";
import { ToastViewport, useToast } from "../components/Toast";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

const emptyForm = {
  name: "",
  image: "",
  category: "",
  foodType: "veg",
  description: "",
  spiceLevel: "medium",
  isRecommended: false,
  mrp: "",
  gst: "",
};

const defaultCategories = [
  "Starters",
  "Main Course",
  "Breads",
  "Rice",
  "Desserts",
  "Beverages",
];

export default function Products() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast, showToast } = useToast();

  const fetchItems = async () => {
    const res = await API.get("/products");
    setItems(res.data.products || []);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const categories = useMemo(() => {
    const fromItems = items.map((item) => item.category).filter(Boolean);
    return Array.from(new Set([...defaultCategories, ...fromItems]));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items;

    return items.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const groupedItems = useMemo(() => {
    return filteredItems.reduce((groups, item) => {
      const key = item.category || "Uncategorized";
      return { ...groups, [key]: [...(groups[key] || []), item] };
    }, {});
  }, [filteredItems]);

  const normalizePayload = () => ({
    name: form.name.trim(),
    image: form.image.trim(),
    category: form.category.trim(),
    foodType: form.foodType || "veg",
    description: form.description.trim(),
    spiceLevel: form.spiceLevel || "medium",
    isRecommended: Boolean(form.isRecommended),
    mrp: Number(form.mrp || 0),
    sellingPrice: Number(form.mrp || 0),
    gst: Number(form.gst || 0),
    purchasePrice: 0,
    openingStock: 9999,
    stock: 9999,
    unit: "Plate",
  });

  const submit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) return showToast("Item name required", "warning");
    if (!form.category.trim()) return showToast("Category required", "warning");
    if (Number(form.mrp || 0) <= 0) return showToast("MRP required", "warning");

    try {
      await API.post("/products", normalizePayload());
      showToast("Menu item saved", "success");
      setForm(emptyForm);
      setShowAdd(false);
      fetchItems();
    } catch (error) {
      showToast(error.response?.data?.message || "Menu item save failed");
    }
  };

  const openEdit = (item) => {
    setSelectedItem(item);
    setForm({
      name: item.name || "",
      image: item.image || "",
      category: item.category || "",
      foodType: item.foodType || "veg",
      description: item.description || "",
      spiceLevel: item.spiceLevel || "medium",
      isRecommended: Boolean(item.isRecommended),
      mrp: item.mrp || item.sellingPrice || "",
      gst: item.gst || "",
    });
    setShowEdit(true);
  };

  const updateItem = async (e) => {
    e.preventDefault();

    try {
      await API.put(`/products/${selectedItem._id}`, normalizePayload());
      showToast("Menu item updated", "success");
      setShowEdit(false);
      setSelectedItem(null);
      setForm(emptyForm);
      fetchItems();
    } catch (error) {
      showToast(error.response?.data?.message || "Menu item update failed");
    }
  };

  const deleteItem = async (password) => {
    if (!deleteTarget) return;

    try {
      await API.delete(`/products/${deleteTarget._id}`, { data: { password } });
      showToast("Menu item deleted", "success");
      setShowView(false);
      setSelectedItem(null);
      setDeleteTarget(null);
      fetchItems();
    } catch (error) {
      showToast(error.response?.data?.message || "Menu item delete failed");
    }
  };

  return (
    <div className="products-page menu-management-page">
      <ToastViewport toast={toast} />

      <div className="products-head menu-management-head">
        <div>
          <span><Utensils size={16} /> Restaurant Menu</span>
          <h1>Menu Items</h1>
          <p>Add items by category with photo, MRP and optional GST for clean invoice breakup.</p>
        </div>
        <button
          className="add-product-main-btn"
          onClick={() => {
            setForm(emptyForm);
            setShowAdd(true);
          }}
        >
          + Add Item
        </button>
      </div>

      <div className="menu-admin-toolbar">
        <input
          placeholder="Search menu item or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div>
          <span>Total Items</span>
          <b>{items.length}</b>
        </div>
        <div>
          <span>Categories</span>
          <b>{Object.keys(groupedItems).length}</b>
        </div>
      </div>

      <div className="menu-admin-sections">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="restaurant-empty">
            <ImagePlus size={34} />
            <p>No menu item found.</p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([category, categoryItems]) => (
            <section className="menu-category-section" key={category}>
              <div className="menu-category-section-head">
                <h2>{category}</h2>
                <span>{categoryItems.length} items</span>
              </div>

              <div className="menu-admin-grid">
                {categoryItems.map((item) => (
                  <article className="menu-admin-card" key={item._id}>
                    <div className="menu-admin-image">
                      {item.image ? (
                        <img src={item.image} alt={item.name} />
                      ) : (
                        <ImagePlus size={30} />
                      )}
                    </div>

                    <div className="menu-admin-card-body">
                      <span>{item.category || "Uncategorized"}</span>
                      <h3>{item.name}</h3>
                      <small className={item.foodType === "non-veg" ? "food-type non-veg" : "food-type veg"}>
                        {item.foodType === "non-veg" ? <Flame size={12} /> : <Leaf size={12} />}
                        {item.foodType === "non-veg" ? "Non-Veg" : "Veg"}
                      </small>
                      {item.description && <em>{item.description}</em>}
                      <p>
                        <b>MRP Rs {Number(item.mrp || item.sellingPrice || 0).toFixed(2)}</b>
                        {Number(item.gst || 0) > 0 && <small>{item.gst}% GST included</small>}
                        {item.isRecommended && <small className="recommended-chip"><Sparkles size={12} /> Recommended</small>}
                      </p>
                    </div>

                    <div className="menu-admin-actions">
                      <button title="View item" onClick={() => { setSelectedItem(item); setShowView(true); }}>
                        <Eye size={16} />
                      </button>
                      <button title="Edit item" onClick={() => openEdit(item)}>
                        <Pencil size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {showAdd && (
        <MenuItemModal title="Add Menu Item" close={() => setShowAdd(false)}>
          <MenuItemForm
            form={form}
            setForm={setForm}
            categories={categories}
            submit={submit}
            buttonText="Save Item"
          />
        </MenuItemModal>
      )}

      {showEdit && (
        <MenuItemModal title="Edit Menu Item" close={() => setShowEdit(false)}>
          <MenuItemForm
            form={form}
            setForm={setForm}
            categories={categories}
            submit={updateItem}
            buttonText="Update Item"
          />
        </MenuItemModal>
      )}

      {showView && selectedItem && (
        <MenuItemModal title="Menu Item Details" close={() => setShowView(false)}>
          <div className="menu-item-detail">
            <div className="menu-item-detail-image">
              {selectedItem.image ? <img src={selectedItem.image} alt={selectedItem.name} /> : <ImagePlus size={40} />}
            </div>
            <div className="menu-item-detail-content">
              <div className="menu-item-detail-title">
                <div>
                  <span>{selectedItem.category || "Uncategorized"}</span>
                  <h3>{selectedItem.name}</h3>
                </div>
                <b className={`food-type ${selectedItem.foodType === "non-veg" ? "non-veg" : "veg"}`}>
                  {selectedItem.foodType === "non-veg" ? "Non-Veg" : "Veg"}
                </b>
              </div>

              {selectedItem.description && <p className="menu-item-detail-description">{selectedItem.description}</p>}

              <div className="menu-item-detail-grid">
                <InfoTile label="Spice" value={selectedItem.spiceLevel || "Medium"} />
                <InfoTile label="MRP" value={`Rs ${Number(selectedItem.mrp || selectedItem.sellingPrice || 0).toFixed(2)}`} />
                <InfoTile
                  label="GST"
                  value={Number(selectedItem.gst || 0) > 0 ? `${selectedItem.gst}% included` : "Not applied"}
                />
                <InfoTile label="Stock" value={Number(selectedItem.stock || 0)} />
              </div>

              <div className="menu-item-detail-actions">
                <button type="button" onClick={() => {
                  setShowView(false);
                  openEdit(selectedItem);
                }}>
                  Edit Item
                </button>
                <button className="delete-product-btn" onClick={() => setDeleteTarget(selectedItem)}>
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </MenuItemModal>
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name || "menu item"}?`}
        message="Menu item will be deleted. Enter login password to continue."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteItem}
      />
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function MenuItemModal({ title, close, children }) {
  return (
    <div className="product-modal-overlay">
      <div className="product-modal menu-item-modal">
        <div className="product-modal-head">
          <h2>{title}</h2>
          <button onClick={close}>x</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MenuItemForm({ form, setForm, categories, submit, buttonText }) {
  const handleImageFile = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, image: String(reader.result || "") });
    reader.readAsDataURL(file);
  };

  return (
    <form className="menu-item-form" onSubmit={submit}>
      <label className="menu-image-uploader">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleImageFile(e.target.files?.[0])}
        />
        {form.image ? <img src={form.image} alt="Menu item preview" /> : <ImagePlus size={36} />}
        <span>Upload item image</span>
      </label>

      <input
        placeholder="Product name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />

      <div className="category-input-row">
        <select
          value={categories.includes(form.category) ? form.category : ""}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          <option value="">Select category</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <input
          placeholder="Or new category"
          value={categories.includes(form.category) ? "" : form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
      </div>

      <div className="food-type-row">
        <button
          type="button"
          className={form.foodType !== "non-veg" ? "active veg" : ""}
          onClick={() => setForm({ ...form, foodType: "veg" })}
        >
          <Leaf size={16} />
          Veg
        </button>
        <button
          type="button"
          className={form.foodType === "non-veg" ? "active non-veg" : ""}
          onClick={() => setForm({ ...form, foodType: "non-veg" })}
        >
          <Flame size={16} />
          Non-Veg
        </button>
      </div>

      <textarea
        placeholder="Short item description for customer menu"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      <div className="category-input-row">
        <select
          value={form.spiceLevel}
          onChange={(e) => setForm({ ...form, spiceLevel: e.target.value })}
        >
          <option value="mild">Mild</option>
          <option value="medium">Medium Spice</option>
          <option value="spicy">Spicy</option>
        </select>
        <label className="recommended-toggle">
          <input
            type="checkbox"
            checked={form.isRecommended}
            onChange={(e) => setForm({ ...form, isRecommended: e.target.checked })}
          />
          <Sparkles size={16} />
          Recommended
        </label>
      </div>

      <input
        placeholder="Product image URL optional"
        value={form.image.startsWith("data:") ? "" : form.image}
        onChange={(e) => setForm({ ...form, image: e.target.value })}
      />

      <div className="price-tax-row">
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="MRP / Final price"
          value={form.mrp}
          onChange={(e) => setForm({ ...form, mrp: e.target.value })}
          required
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="GST % optional"
          value={form.gst}
          onChange={(e) => setForm({ ...form, gst: e.target.value })}
        />
      </div>

      <button>{buttonText}</button>
    </form>
  );
}
