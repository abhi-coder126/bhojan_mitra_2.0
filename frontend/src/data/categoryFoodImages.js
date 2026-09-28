export const categoryFoodImages = [
  { name: "Starters", image: "/category-food/starters.png", matches: /starter|snack|appetizer|tikka|kebab|fries/i },
  { name: "Main Course", image: "/category-food/main-course.png", matches: /main|curry|gravy|paneer|sabzi|dal/i },
  { name: "South Indian", image: "/category-food/South Indian.png", matches: /south indian/i },
  { name: "North Indian", image: "/category-food/North Indian.png", matches: /north indian/i },
  { name: "Chinese", image: "/category-food/Chinese.png", matches: /chinese/i },
  { name: "Momos", image: "/category-food/starters.png", matches: /momo/i },
  { name: "Soups", image: "/category-food/main-course.png", matches: /soup/i },
  { name: "Salads", image: "/category-food/Salad.png", matches: /salad/i },
  { name: "Sandwich", image: "/category-food/rolls.png", matches: /sandwich/i },
  { name: "Chole Bhature", image: "/category-food/Chole Bhature.png", matches: /chole bhature/i },
  { name: "Paratha", image: "/category-food/Paratha.png", matches: /paratha/i },
  { name: "Breads", image: "/category-food/breads.png", matches: /bread|naan|roti|chapati|paratha/i },
  { name: "Biryani", image: "/category-food/Biryani.png", matches: /biryani/i },
  { name: "Rice", image: "/category-food/rice.png", matches: /rice|biryani|pulao/i },
  { name: "Cake", image: "/category-food/Cake.png", matches: /cake/i },
  { name: "Pastry", image: "/category-food/Pastry.png", matches: /pastry/i },
  { name: "Rasmalai", image: "/category-food/Rasmalai.png", matches: /rasmalai/i },
  { name: "Desserts", image: "/category-food/desserts.png", matches: /dessert|sweet|cake|ice cream|brownie/i },
  { name: "Milk Shake", image: "/category-food/Shake.png", matches: /milk ?shake/i },
  { name: "Lassi", image: "/category-food/Lassi.png", matches: /lassi/i },
  { name: "Refreshers", image: "/category-food/refreshers.png", matches: /refresher|mocktail|cooler/i },
  { name: "Beverages", image: "/category-food/beverages.png", matches: /beverage|drink|shake|juice|smoothie|coffee|tea/i },
  { name: "Burgers", image: "/category-food/Burger.png", matches: /burger/i },
  { name: "Pizza", image: "/category-food/pizza.png", matches: /pizza/i },
  { name: "Rolls", image: "/category-food/rolls.png", matches: /roll|wrap|shawarma|frankie/i },
  { name: "Dosa", image: "/category-food/Dosa.png", matches: /dosa/i },
  { name: "Idli", image: "/category-food/Idli.png", matches: /idli/i },
  { name: "Pasta", image: "/category-food/Pasta.png", matches: /pasta/i },
  { name: "Noodles", image: "/category-food/Noodles.png", matches: /noodle/i },
];

export const generatedCategoryImage = (name = "") =>
  categoryFoodImages.find((category) => category.matches.test(name.trim()))?.image || "";

export async function generatedImageDataUrl(src) {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Image could not be loaded");
  const image = new Image();
  image.src = URL.createObjectURL(await response.blob());
  try {
    await image.decode();
    const scale = Math.min(1, 256 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(image.src);
  }
}
