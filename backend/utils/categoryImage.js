const CategoryImage = require("../models/CategoryImage");

function validateCategoryImage(body) {
  if (body.categoryImage === undefined) return;
  const image = body.categoryImage;
  if (typeof body.category !== "string" || !body.category.trim() ||
      typeof image !== "string" || image.length > 750000 ||
      (image !== "" && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))) {
    const error = new Error("Choose a PNG, JPG or WebP category image under 500 KB.");
    error.statusCode = 400;
    throw error;
  }
}

async function saveCategoryImage(body) {
  if (body.categoryImage === undefined) return;
  const name = body.category.trim();
  if (!body.categoryImage) {
    await CategoryImage.deleteOne({ name });
    return;
  }
  await CategoryImage.findOneAndUpdate({ name }, { $set: { dataUrl: body.categoryImage } },
    { upsert: true, runValidators: true });
}

module.exports = { validateCategoryImage, saveCategoryImage };
