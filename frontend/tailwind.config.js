/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#dc2626",
        "brand-dark": "#7f0615",
        "app-bg": "#fff1f2",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(15, 23, 42, 0.08)",
        modal: "0 35px 90px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [],
};
