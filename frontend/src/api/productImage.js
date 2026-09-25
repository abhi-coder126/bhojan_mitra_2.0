import { API_BASE_URL } from "./axios";

// Menu pictures are stored as base64 in Mongo but never sent inside list responses --
// they would push a 50-item menu past 2 MB. Lists carry a `hasImage` flag and the
// browser loads each picture from here instead, in parallel and from its own cache.
export const productImageUrl = (productId) => `${API_BASE_URL}/products/${productId}/image`;

// True for both shapes a list row can arrive in: the new `hasImage` flag, and an
// item that still carries a full data URL (a freshly picked file in a form).
export const hasProductImage = (item) => Boolean(item?.hasImage || item?.image);

// What to point an <img> at: a just-picked/base64 image wins, otherwise the endpoint.
export const productImageSrc = (item) =>
  item?.image ? item.image : item?.hasImage ? productImageUrl(item._id) : "";

export const categoryImageSrc = (record) => record?._id
  ? `${API_BASE_URL}/products/category-images/${record._id}?v=${encodeURIComponent(record.updatedAt || "")}`
  : "";
