import { useEffect, useState } from "react";
import API from "../api/axios";

export default function AllProducts() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");

  const fetchProducts = async () => {
    const res = await API.get("/products");
    setProducts(res.data.products || []);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((product) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;

    return (
      product.name?.toLowerCase().includes(q) ||
      product.barcode?.toLowerCase().includes(q) ||
      product.sku?.toLowerCase().includes(q) ||
      product.category?.toLowerCase().includes(q)
    );
  });

  const lowStockCount = products.filter(
    (product) =>
      Number(product.stock || 0) <= Number(product.lowStockLimit || 0)
  ).length;

  const totalStock = products.reduce(
    (sum, product) => sum + Number(product.stock || 0),
    0
  );

  return (
    <div className="inventory-page">
      <div className="page-head">
        <div>
          <h1>Inventory Overview</h1>
          <p>Monitor live stock, low-stock items, categories, vendor links and selling prices</p>
        </div>
      </div>

      <div className="inventory-summary-grid">
        <div>
          <span>Total SKUs</span>
          <b>{products.length}</b>
        </div>
        <div>
          <span>Low Stock</span>
          <b>{lowStockCount}</b>
        </div>
        <div>
          <span>Stock Units</span>
          <b>{totalStock}</b>
        </div>
      </div>

      <div className="products-table-card inventory-table-card">
        <div className="inventory-toolbar">
          <h2>All Products</h2>
          <input
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Barcode</th>
              <th>SKU</th>
              <th>Purchase</th>
              <th>Sale</th>
              <th>GST</th>
              <th>Stock</th>
              <th>Vendor</th>
            </tr>
          </thead>

          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="8">No product found</td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product._id}>
                  <td>
                    <div className="product-name-stack">
                      <b>{product.name}</b>
                      <small>{product.category || "No Category"}</small>
                    </div>
                  </td>
                  <td>{product.barcode}</td>
                  <td>{product.sku || "N/A"}</td>
                  <td>₹{product.purchasePrice}</td>
                  <td>₹{product.sellingPrice}</td>
                  <td>{product.gst}%</td>
                  <td>
                    <span
                      className={
                        Number(product.stock) <= Number(product.lowStockLimit || 0)
                          ? "stock-low"
                          : "stock-ok"
                      }
                    >
                      {product.stock} {product.unit}
                    </span>
                  </td>
                  <td>{product.vendorName || product.vendorId?.name || "N/A"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
