import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { categoryImageSrc } from "../api/productImage";
import { categoryFoodImages, generatedCategoryImage, generatedImageDataUrl } from "../data/categoryFoodImages";

export default function CategoryImagePicker({ form, setForm, categoryImages }) {
  const [error, setError] = useState("");
  const name = form.category.trim();
  const saved = categoryImages.find((record) => record.name === name);
  const preview = form.categoryImage ?? (categoryImageSrc(saved) || generatedCategoryImage(name));

  // Images already saved for other categories, offered for reuse so a shared
  // icon (e.g. one "Beverages" picture) need not be re-uploaded per category.
  const reusable = categoryImages.filter((record) => record._id && record.name !== name);

  // The saved image is served as binary from the API, but the form submits a data
  // URL, so re-encode whichever one the user picks.
  const reuse = async (record) => {
    setError("");
    setForm((current) => ({ ...current, categoryImageLoading: true }));
    try {
      const response = await fetch(categoryImageSrc(record));
      if (!response.ok) throw new Error("Category image request failed");
      const blob = await response.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      setForm((current) => current.category.trim() === name
        ? { ...current, categoryImage: dataUrl } : current);
    } catch {
      setError("That image could not be loaded. Please try again.");
    } finally {
      setForm((current) => ({ ...current, categoryImageLoading: false }));
    }
  };

  const upload = async (file) => {
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Choose a PNG, JPG or WebP image up to 5 MB.");
      return;
    }
    setForm((current) => ({ ...current, categoryImageLoading: true }));
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
      const thumbnail = canvas.toDataURL("image/png");
      setForm((current) => current.category.trim() === name
        ? { ...current, categoryImage: thumbnail } : current);
    } catch {
      setError("This image could not be opened. Please choose another file.");
    } finally {
      URL.revokeObjectURL(url);
      setForm((current) => ({ ...current, categoryImageLoading: false }));
    }
  };

  const selectGenerated = async (image) => {
    setError("");
    setForm((current) => ({ ...current, categoryImageLoading: true }));
    try {
      const dataUrl = await generatedImageDataUrl(image);
      setForm((current) => current.category.trim() === name
        ? { ...current, categoryImage: dataUrl } : current);
    } catch {
      setError("That image could not be loaded. Please try again.");
    } finally {
      setForm((current) => ({ ...current, categoryImageLoading: false }));
    }
  };

  return (
    <div className="category-image-picker">
      <div className="category-image-preview">
        {preview ? <img src={preview} alt={`${name} category preview`} /> : <ImagePlus size={28} />}
      </div>
      <div className="category-image-controls">
        <strong>Category image <small>(optional)</small></strong>
        <p>Shown above the category name in the customer menu. Saved with this item for all items in this category.</p>
        <label className="category-image-upload">
          <span>{form.categoryImageLoading ? "Preparing image..." : preview ? "Change category image" : "Upload category image"}</span>
          <input type="file" aria-label="Upload category image" accept="image/png,image/jpeg,image/webp"
            disabled={!name || form.categoryImageLoading}
            onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
        {(form.categoryImage || saved) && <button type="button" className="category-image-remove" disabled={form.categoryImageLoading}
          onClick={() => setForm((current) => ({ ...current, categoryImage: "" }))}>Remove image</button>}
        {!name && <small>Choose or enter a category first.</small>}
        {error && <p role="alert">{error}</p>}

        {name && <div className="category-image-reuse">
          <small>Choose a ready-made food image</small>
          <ul>{categoryFoodImages.map(({ name: label, image }) => (
            <li key={label}><button type="button" disabled={form.categoryImageLoading}
              onClick={() => selectGenerated(image)} title={`Use ${label} image`}>
              <img src={image} alt="" loading="lazy" /><span>{label}</span>
            </button></li>
          ))}</ul>
        </div>}

        {name && reusable.length > 0 && (
          <div className="category-image-reuse">
            <small>Or reuse an image from another category</small>
            <ul>
              {reusable.map((record) => (
                <li key={record._id}>
                  <button
                    type="button"
                    disabled={form.categoryImageLoading}
                    onClick={() => reuse(record)}
                    title={`Use the ${record.name} image`}
                  >
                    <img src={categoryImageSrc(record)} alt="" />
                    <span>{record.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
