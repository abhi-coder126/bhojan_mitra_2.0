import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import API, { API_BASE_URL } from "../api/axios";
import AsyncButton from "./AsyncButton";
import ConfirmActionModal from "./ConfirmActionModal";

const MAX_NAME = 60;
const emptyDraft = { name: "", previousName: "", image: undefined };

// A saved picture is served as binary from its own endpoint; `image` on the draft
// is a data URL only while the user has just picked a new file.
const savedImageSrc = (category) =>
  category.imageId
    ? `${API_BASE_URL}/products/category-images/${category.imageId}?v=${encodeURIComponent(category.updatedAt || "")}`
    : "";

// Shrunk before upload: a category tile is small, and the raw file would blow past
// the server's size limit for no visible gain.
const toThumbnail = async (file) => {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 256 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
};

export default function CategoryManager({ onClose, onChanged, showToast }) {
  const [categories, setCategories] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    const res = await API.get("/products/categories");
    setCategories(res.data.categories || []);
  }, []);

  useEffect(() => {
    load()
      .catch((cause) => showToast(cause.response?.data?.message || "Could not load categories", "error"))
      .finally(() => setLoading(false));
  }, [load, showToast]);

  const editing = Boolean(draft.previousName);
  // Falls back to whatever is already saved for the category being edited.
  const preview =
    draft.image !== undefined
      ? draft.image
      : savedImageSrc(categories.find((row) => row.name === draft.previousName) || {});

  const reset = () => {
    setDraft(emptyDraft);
    setError("");
  };

  const pickImage = async (file) => {
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Choose a PNG, JPG or WebP image up to 5 MB.");
      return;
    }
    try {
      const thumbnail = await toThumbnail(file);
      setDraft((current) => ({ ...current, image: thumbnail }));
    } catch {
      setError("That image could not be opened. Please choose another file.");
    }
  };

  const save = async (event) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return setError("Enter a category name");
    if (busy) return;

    setBusy(true);
    setError("");
    try {
      await API.put("/products/categories", {
        name,
        previousName: draft.previousName || "",
        // Omitted entirely when untouched, so an edit does not wipe the picture.
        ...(draft.image !== undefined ? { image: draft.image } : {}),
      });
      showToast(editing ? "Category updated" : "Category added", "success");
      reset();
      await load();
      onChanged?.();
    } catch (cause) {
      setError(cause.response?.data?.message || "Could not save this category");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal-card large category-manager" role="dialog" aria-modal="true" aria-label="Categories">
        <div className="modal-head">
          <h2>Categories</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close" title="Close">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <form className="category-draft" onSubmit={save}>
          <button
            type="button"
            className="category-draft-image"
            onClick={() => fileInput.current?.click()}
            title={preview ? "Change picture" : "Add a picture"}
          >
            {preview ? <img src={preview} alt="" /> : <ImagePlus size={26} />}
          </button>
          <input
            ref={fileInput}
            type="file"
            className="hidden-file-input"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Category picture"
            onChange={(event) => {
              pickImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          <div className="category-draft-fields">
            <input
              placeholder="Category name, e.g. Starters"
              maxLength={MAX_NAME}
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              required
            />
            <p>Shown above the items in the customer menu. The picture is optional.</p>
          </div>

          <div className="category-draft-actions">
            {preview && (
              <button type="button" onClick={() => setDraft((current) => ({ ...current, image: "" }))}>
                Remove picture
              </button>
            )}
            {editing && (
              <button type="button" onClick={reset}>
                Cancel
              </button>
            )}
            <button type="submit" className="add-product-main-btn" disabled={busy}>
              <Plus size={15} /> {editing ? "Save changes" : "Add category"}
            </button>
          </div>

          {error && <p className="async-form-error" role="alert">{error}</p>}
        </form>

        {loading ? (
          <p className="bm-empty">Loading categories...</p>
        ) : categories.length === 0 ? (
          <p className="bm-empty">No categories yet. Add the first one above.</p>
        ) : (
          <ul className="category-list">
            {categories.map((category) => (
              <li key={category.name}>
                <span className="category-list-thumb">
                  {category.imageId ? <img src={savedImageSrc(category)} alt="" /> : <ImagePlus size={18} />}
                </span>
                <span className="category-list-name">
                  <b>{category.name}</b>
                  <small>{category.items} {category.items === 1 ? "item" : "items"}</small>
                </span>
                <span className="row-actions">
                  <button
                    type="button"
                    className="bm-btn bm-btn-sm"
                    onClick={() => {
                      setError("");
                      setDraft({ name: category.name, previousName: category.name, image: undefined });
                    }}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <AsyncButton
                    className="bm-btn bm-btn-sm"
                    disabled={category.items > 0}
                    title={category.items > 0 ? "Move or delete its items first" : "Delete category"}
                    onClick={() => setConfirm(category)}
                  >
                    <Trash2 size={14} />
                  </AsyncButton>
                </span>
              </li>
            ))}
          </ul>
        )}

        <ConfirmActionModal
          open={Boolean(confirm)}
          title={`Delete "${confirm?.name}"?`}
          message="The category and its picture are removed. Items are not affected, because only empty categories can be deleted."
          confirmText="Delete category"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              await API.delete(`/products/categories/${encodeURIComponent(confirm.name)}`);
              showToast("Category deleted", "success");
              await load();
              onChanged?.();
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
