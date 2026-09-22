import { useEffect, useMemo, useRef, useState } from "react";
import { BadgePercent, CheckCircle2, ChefHat, Clock, Flame, Gift, History, Leaf, LogOut, Mail, MapPin, Minus, PackageCheck, PartyPopper, Phone, Plus, Search, ShieldCheck, ShoppingBag, Soup, Sparkles, Star, UserCircle2, Utensils, X } from "lucide-react";
import { useParams } from "react-router-dom";
import API from "../api/axios";
import PhoneInput from "../components/PhoneInput";
import PublicLottie from "../components/PublicLottie";
import { ToastViewport, useToast } from "../components/Toast";
import { resetRecaptchaVerifier, sendPhoneOtp } from "../firebase";
import ScratchCard from "../components/ScratchCard";

const CUSTOMER_TOKEN_KEY = "bhojan_customer_token";
const CUSTOMER_PROFILE_KEY = "bhojan_customer_profile";

const loadStoredCustomerAuth = () => {
  try {
    const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    const profile = JSON.parse(localStorage.getItem(CUSTOMER_PROFILE_KEY) || "null");
    return token && profile ? { token, profile } : { token: "", profile: null };
  } catch {
    return { token: "", profile: null };
  }
};

// Cart survives a page refresh but not a closed tab -- sessionStorage is exactly
// that lifetime, and keying by table keeps separate QR tables from mixing carts.
const cartStorageKey = (tableNo) => `bhojan_cart_${tableNo}`;

const loadStoredCart = (tableNo) => {
  try {
    return JSON.parse(sessionStorage.getItem(cartStorageKey(tableNo)) || "[]");
  } catch {
    return [];
  }
};

export default function CustomerMenu() {
  const { tableNo } = useParams();
  const isDelivery = tableNo === "delivery";
  const [products, setProducts] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [cart, setCart] = useState(() => loadStoredCart(tableNo));
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeFoodType, setActiveFoodType] = useState("all");
  const [checkoutStep, setCheckoutStep] = useState("cart");
  const [search, setSearch] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponSavedPopup, setCouponSavedPopup] = useState(null);
  const [customer, setCustomer] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    deliveryAddress: "",
    note: "",
  });
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [itemRatings, setItemRatings] = useState({});
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const cartPanelRef = useRef(null);
  const { toast, showToast } = useToast();

  // Delivery orders require both email and phone verification before checkout.
  const [emailOtp, setEmailOtp] = useState({ sent: false, code: "", verified: false, sending: false, verifying: false });
  const [phoneOtp, setPhoneOtp] = useState({ sent: false, code: "", verified: false, sending: false, verifying: false });
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");

  // Customer account (email-OTP login) -- persisted so a delivery customer isn't
  // asked to re-verify or retype their address on their next visit. Dine-in login
  // is optional (a "save my order & earn rewards" prompt, never required).
  const [customerAuth, setCustomerAuth] = useState({ token: "", profile: null });
  const [optionalLoginOpen, setOptionalLoginOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [addressLabel, setAddressLabel] = useState("Home");
  const [addingAddress, setAddingAddress] = useState(false);
  const [orderHistory, setOrderHistory] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingReward, setPendingReward] = useState(null);
  const [rewardsList, setRewardsList] = useState(null);
  const [rewardsOpen, setRewardsOpen] = useState(false);

  const persistCustomerAuth = (token, profile) => {
    setCustomerAuth({ token, profile });
    try {
      localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
      localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // Storage unavailable (e.g. private mode) -- session still works for this visit.
    }
  };

  const clearCustomerAuth = () => {
    setCustomerAuth({ token: "", profile: null });
    setOrderHistory(null);
    try {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
      localStorage.removeItem(CUSTOMER_PROFILE_KEY);
    } catch {
      // Ignore -- nothing to clean up if storage was never available.
    }
  };

  // Rehydrate a returning customer's session on load and re-validate it against the
  // server (a stored token can be stale/revoked).
  useEffect(() => {
    const stored = loadStoredCustomerAuth();
    if (!stored.token) return;

    API.get("/customer-auth/me", { headers: { Authorization: `Bearer ${stored.token}` } })
      .then((res) => {
        persistCustomerAuth(stored.token, res.data.customer);
        setCustomer((prev) => ({
          ...prev,
          customerName: prev.customerName || res.data.customer.name || "",
          customerPhone: prev.customerPhone || res.data.customer.contact || "",
          customerEmail: prev.customerEmail || res.data.customer.email || "",
        }));
      })
      .catch(() => clearCustomerAuth());
  }, []);

  useEffect(() => {
    const fetchMenu = async () => {
      setMenuLoading(true);
      try {
        const res = await API.get("/restaurant-orders/menu");
        setProducts(res.data.products || []);
      } catch (error) {
        showToast(error.response?.data?.message || "Menu could not be loaded");
      } finally {
        setMenuLoading(false);
      }
    };

    fetchMenu();
  }, [showToast]);

  useEffect(() => {
    if (!orderPlaced?._id || ["served", "cancelled"].includes(orderPlaced.status)) return undefined;

    const fetchOrderStatus = async () => {
      try {
        const res = await API.get(`/restaurant-orders/${orderPlaced._id}`);
        setOrderPlaced(res.data.order);
      } catch (error) {
        console.log("Order status fetch error:", error);
      }
    };

    const timer = setInterval(fetchOrderStatus, 4000);
    return () => clearInterval(timer);
  }, [orderPlaced?._id, orderPlaced?.status]);

  // The moment a logged-in customer's order is marked served, check for a fresh
  // unscratched reward and pop the scratch card.
  useEffect(() => {
    if (orderPlaced?.status !== "served" || !customerAuth.token) return;

    API.get("/customer-auth/me/rewards", { headers: { Authorization: `Bearer ${customerAuth.token}` } })
      .then((res) => {
        const unscratched = (res.data.rewards || []).find((r) => !r.scratched && !r.expired);
        if (unscratched) setPendingReward(unscratched);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderPlaced?.status]);

  const scratchRewardHandler = async () => {
    if (!pendingReward) return;
    try {
      const res = await API.patch(
        `/customer-auth/me/rewards/${pendingReward.id}/scratch`,
        {},
        { headers: { Authorization: `Bearer ${customerAuth.token}` } }
      );
      setPendingReward((prev) => ({ ...prev, offerText: res.data.reward.offerText, scratched: true }));
    } catch {
      // The card still shows locally revealed even if this sync fails silently --
      // scratching again on next load simply re-confirms it server-side.
    }
  };

  const offerProducts = useMemo(
    () => products.filter((product) => Number(product.offerPercent || 0) > 0).slice(0, 10),
    [products]
  );

  const submitRatings = async () => {
    const ratings = Object.entries(itemRatings)
      .filter(([, stars]) => stars > 0)
      .map(([productId, stars]) => ({ productId, stars }));

    if (ratings.length === 0) return showToast("Tap the stars to rate at least one item", "warning");

    setSubmittingRating(true);
    try {
      await API.post(`/restaurant-orders/${orderPlaced._id}/rate`, { ratings });
      setRatingSubmitted(true);
      showToast("Thanks for rating your order!", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Could not submit rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  const categoryStats = useMemo(() => {
    const stats = new Map();
    const filteredByFoodType = products.filter((product) => {
      if (activeFoodType === "veg") return !isNonVeg(product);
      if (activeFoodType === "non-veg") return isNonVeg(product);
      return true;
    });

    filteredByFoodType.forEach((product) => {
      const category = product.category || "Recommended";
      stats.set(category, (stats.get(category) || 0) + 1);
    });

    return [
      { name: "All", count: filteredByFoodType.length },
      ...Array.from(stats.entries()).map(([name, count]) => ({ name, count })),
    ];
  }, [activeFoodType, products]);

  useEffect(() => {
    if (activeCategory === "All") return;
    const exists = categoryStats.some((category) => category.name === activeCategory);
    if (!exists) setActiveCategory("All");
  }, [activeCategory, categoryStats]);

  const visibleProducts = useMemo(() => {
    const q = search.toLowerCase().trim();

    return products.filter((product) => {
      const category = product.category || "Recommended";
      const categoryMatch = activeCategory === "All" || category === activeCategory;
      const foodTypeMatch =
        activeFoodType === "all" ||
        (activeFoodType === "veg" && !isNonVeg(product)) ||
        (activeFoodType === "non-veg" && isNonVeg(product));
      const searchMatch =
        !q ||
        product.name?.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q) ||
        product.description?.toLowerCase().includes(q);

      return categoryMatch && foodTypeMatch && searchMatch;
    });
  }, [activeCategory, activeFoodType, products, search]);

  function isNonVeg(product) {
    const marker = `${product.foodType || ""} ${product.category || ""} ${product.name || ""}`.toLowerCase();
    return marker.includes("non-veg") || marker.includes("non veg") || marker.includes("chicken") || marker.includes("mutton") || marker.includes("fish") || marker.includes("egg");
  }

  const groupedMenu = useMemo(() => {
    const groups = { veg: {}, nonVeg: {} };

    visibleProducts.forEach((product) => {
      const typeKey = isNonVeg(product) ? "nonVeg" : "veg";
      const category = product.category || "Recommended";
      groups[typeKey][category] = [...(groups[typeKey][category] || []), product];
    });

    return groups;
  }, [visibleProducts]);

  const updateCart = (product, change) => {
    if (coupon) {
      setCoupon(null);
      setCouponCode("");
      showToast("Coupon removed because the cart changed", "warning");
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product._id);

      if (!existing && change > 0) {
        const mrp = Number(product.mrp || product.sellingPrice || 0);
        const offerPercent = Number(product.offerPercent || 0);
        const rate = offerPercent > 0 ? mrp * (1 - offerPercent / 100) : mrp;

        return [
          ...current,
          {
            productId: product._id,
            name: product.name,
            image: product.image,
            category: product.category || "Recommended",
            qty: 1,
            rate,
            originalRate: mrp,
            offerPercent,
            gst: Number(product.gst || 0),
          },
        ];
      }

      return current
        .map((item) => {
          if (item.productId !== product._id) return item;
          return { ...item, qty: Math.max(Number(item.qty) + change, 0) };
        })
        .filter((item) => item.qty > 0);
    });
  };

  const cartQty = cart.reduce((sum, item) => sum + Number(item.qty), 0);
  const grandTotal = cart.reduce((sum, item) => sum + Number(item.rate) * Number(item.qty), 0);
  const gstAmount = cart.reduce((sum, item) => {
    const lineTotal = Number(item.rate) * Number(item.qty);
    const gst = Number(item.gst || 0);
    if (gst <= 0) return sum;
    const baseAmount = lineTotal / (1 + gst / 100);
    return sum + (lineTotal - baseAmount);
  }, 0);
  const subTotal = grandTotal - gstAmount;
  const discountAmount = Math.min(Number(coupon?.discountAmount || 0), grandTotal);
  const payableTotal = Math.max(grandTotal - discountAmount, 0);
  const statusSteps = [
    {
      key: "new",
      title: "Order sent",
      text: "Your order has reached the counter.",
      icon: Clock,
    },
    {
      key: "accepted",
      title: "Accepted",
      text: "The restaurant has accepted your order.",
      icon: CheckCircle2,
    },
    {
      key: "preparing",
      title: "Preparing",
      text: "Your order is being prepared in the kitchen.",
      icon: ChefHat,
    },
    {
      key: "ready",
      title: "Ready",
      text: "Your order is ready and will be served soon.",
      icon: PackageCheck,
    },
  ];
  const statusRank = { new: 0, accepted: 1, preparing: 2, ready: 3, served: 4, cancelled: -1 };
  const currentStatusRank = statusRank[orderPlaced?.status] ?? 0;

  useEffect(() => {
    if (cart.length === 0) setCheckoutStep("cart");
  }, [cart.length]);

  useEffect(() => {
    try {
      sessionStorage.setItem(cartStorageKey(tableNo), JSON.stringify(cart));
    } catch {
      // Storage unavailable (e.g. private mode) -- cart just won't survive a refresh.
    }
  }, [cart, tableNo]);

  const normalizedEmail = customer.customerEmail.trim().toLowerCase();
  // A returning logged-in customer whose form still matches their saved profile
  // skips OTP entirely -- that's the "don't ask again" behaviour for repeat visits.
  const isReturningCustomer =
    Boolean(customerAuth.token) &&
    customerAuth.profile?.contact === customer.customerPhone &&
    customer.customerPhone !== "" &&
    (customerAuth.profile?.email === normalizedEmail || !normalizedEmail);
  const isEmailVerified = isReturningCustomer || (emailOtp.verified && verifiedEmail === normalizedEmail && normalizedEmail !== "");
  const isPhoneVerified = isReturningCustomer || (phoneOtp.verified && verifiedPhone === customer.customerPhone && customer.customerPhone !== "");
  const savedAddresses = customerAuth.profile?.addresses || [];

  const sendEmailOtpHandler = async () => {
    if (!customer.customerName.trim()) {
      return showToast("Enter your name first", "warning");
    }
    if (!customer.customerPhone.trim()) {
      return showToast("Enter your phone number first", "warning");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return showToast("Enter a valid email first", "warning");
    }

    setEmailOtp((prev) => ({ ...prev, sending: true }));
    try {
      await API.post("/otp/email/send", { email: normalizedEmail });
      setEmailOtp({ sent: true, code: "", verified: false, sending: false, verifying: false });
      showToast("OTP sent to your email", "success");
    } catch (error) {
      setEmailOtp((prev) => ({ ...prev, sending: false }));
      showToast(error.response?.data?.message || "Could not send email OTP");
    }
  };

  const verifyEmailOtpHandler = async () => {
    if (!emailOtp.code.trim()) return showToast("Enter the OTP sent to your email", "warning");

    setEmailOtp((prev) => ({ ...prev, verifying: true }));
    try {
      const res = await API.post("/otp/email/verify", {
        email: normalizedEmail,
        code: emailOtp.code.trim(),
        name: customer.customerName.trim(),
        phone: customer.customerPhone,
      });
      setVerifiedEmail(normalizedEmail);
      setEmailOtp((prev) => ({ ...prev, verified: true, verifying: false }));
      if (res.data.token) {
        persistCustomerAuth(res.data.token, res.data.customer);
        setAuthModalOpen(false);
      }
      showToast("Email verified", "success");
    } catch (error) {
      setEmailOtp((prev) => ({ ...prev, verifying: false }));
      showToast(error.response?.data?.message || "Incorrect OTP");
    }
  };

  const sendPhoneOtpHandler = async () => {
    if (customer.customerPhone.length !== 10) {
      return showToast("Enter a valid 10-digit phone number first", "warning");
    }

    setPhoneOtp((prev) => ({ ...prev, sending: true }));
    try {
      const result = await sendPhoneOtp(`+91${customer.customerPhone}`, "recaptcha-container");
      setConfirmationResult(result);
      setPhoneOtp({ sent: true, code: "", verified: false, sending: false, verifying: false });
      showToast("OTP sent to your phone", "success");
    } catch (error) {
      resetRecaptchaVerifier();
      setPhoneOtp((prev) => ({ ...prev, sending: false }));
      showToast(error.message?.includes("too-many-requests") ? "Too many attempts, try again later" : "Could not send phone OTP");
    }
  };

  const verifyPhoneOtpHandler = async () => {
    if (!confirmationResult) return showToast("Send the phone OTP first", "warning");
    if (!phoneOtp.code.trim()) return showToast("Enter the OTP sent to your phone", "warning");

    setPhoneOtp((prev) => ({ ...prev, verifying: true }));
    try {
      await confirmationResult.confirm(phoneOtp.code.trim());
      setVerifiedPhone(customer.customerPhone);
      setPhoneOtp((prev) => ({ ...prev, verified: true, verifying: false }));
      showToast("Phone verified", "success");
    } catch {
      setPhoneOtp((prev) => ({ ...prev, verifying: false }));
      showToast("Incorrect OTP");
    }
  };

  const saveAddressHandler = async () => {
    if (!customer.deliveryAddress.trim()) {
      return showToast("Type the delivery address first, then save it", "warning");
    }

    setAddingAddress(true);
    try {
      const res = await API.post(
        "/customer-auth/me/addresses",
        { label: addressLabel, address: customer.deliveryAddress.trim(), isDefault: savedAddresses.length === 0 },
        { headers: { Authorization: `Bearer ${customerAuth.token}` } }
      );
      persistCustomerAuth(customerAuth.token, { ...customerAuth.profile, addresses: res.data.addresses });
      showToast("Address saved", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Could not save address");
    } finally {
      setAddingAddress(false);
    }
  };

  const fetchOrderHistory = async () => {
    if (!customerAuth.token) return;
    setHistoryOpen((open) => !open);
    if (orderHistory) return;

    try {
      const res = await API.get("/customer-auth/me/orders", {
        headers: { Authorization: `Bearer ${customerAuth.token}` },
      });
      setOrderHistory(res.data.orders || []);
    } catch {
      setOrderHistory([]);
    }
  };

  const fetchMyRewards = async () => {
    if (!customerAuth.token) return;
    setRewardsOpen((open) => !open);
    if (rewardsList) return;

    try {
      const res = await API.get("/customer-auth/me/rewards", {
        headers: { Authorization: `Bearer ${customerAuth.token}` },
      });
      setRewardsList(res.data.rewards || []);
    } catch {
      setRewardsList([]);
    }
  };

  const placeOrder = async () => {
    if (cart.length === 0) return showToast("Please add a menu item first", "warning");
    if (!customer.customerName.trim() || !customer.customerPhone.trim()) {
      return showToast("Name and contact number required", "warning");
    }
    if (isDelivery && (!customer.customerEmail.trim() || !customer.deliveryAddress.trim())) {
      return showToast("Email and address are required for delivery", "warning");
    }
    if (isDelivery && !isEmailVerified) {
      return showToast("Please verify your email OTP first", "warning");
    }
    if (isDelivery && !isPhoneVerified) {
      return showToast("Please verify your phone OTP first", "warning");
    }

    setPlacing(true);

    try {
      const res = await API.post(
        "/restaurant-orders",
        {
          orderType: isDelivery ? "delivery" : "dine-in",
          tableNo: isDelivery ? "" : tableNo,
          orderSource: "qr",
          ...customer,
          couponCode: coupon?.code || "",
          items: cart.map((item) => ({ productId: item.productId, qty: item.qty })),
        },
        customerAuth.token ? { headers: { Authorization: `Bearer ${customerAuth.token}` } } : undefined
      );

      setOrderPlaced(res.data.order);
      setItemRatings({});
      setRatingSubmitted(false);
      setCart([]);
      setCheckoutStep("cart");
      setCoupon(null);
      setCouponCode("");
      setOrderHistory(null);
      // A logged-in customer keeps their name/phone/email/address prefilled for
      // next time; a guest gets a clean form.
      if (!customerAuth.token) {
        setCustomer({ customerName: "", customerPhone: "", customerEmail: "", deliveryAddress: "", note: "" });
        setEmailOtp({ sent: false, code: "", verified: false, sending: false, verifying: false });
        setPhoneOtp({ sent: false, code: "", verified: false, sending: false, verifying: false });
        setConfirmationResult(null);
        setVerifiedEmail("");
        setVerifiedPhone("");
      } else {
        setCustomer((prev) => ({ ...prev, note: "" }));
      }
      showToast("Order sent to the counter", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Order could not be placed");
    } finally {
      setPlacing(false);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return showToast("Enter a coupon code", "warning");
    if (grandTotal <= 0) return showToast("Add an item before applying a coupon", "warning");

    setApplyingCoupon(true);

    try {
      const res = await API.post("/coupons/apply", {
        code: couponCode.trim(),
        billAmount: grandTotal,
      });
      const savedAmount = Number(res.data.discountAmount || 0);
      setCoupon({
        ...res.data.coupon,
        discountAmount: savedAmount,
      });
      setCouponSavedPopup({ code: couponCode.trim().toUpperCase(), amount: savedAmount });
      showToast("Coupon applied", "success");
    } catch (error) {
      setCoupon(null);
      showToast(error.response?.data?.message || "Coupon could not be applied");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponCode("");
  };

  const startCheckout = () => {
    if (cart.length === 0) return showToast("Please add a menu item first", "warning");
    setCheckoutStep("details");
    window.setTimeout(() => {
      cartPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const renderProductCard = (product, index) => {
    const cartItem = cart.find((item) => item.productId === product._id);
    const hue = ["#84091e", "#b3132c", "#7c3aed", "#0f766e", "#b45309"][index % 5];

    return (
      <article className="foodora-card" key={product._id}>
        <div className="foodora-card-media" style={{ backgroundColor: product.image ? "#ffffff" : hue }}>
          {product.image ? (
            <img src={product.image} alt={product.name} />
          ) : (
            <span>{product.name?.slice(0, 1) || "M"}</span>
          )}
          {product.itemType !== "beverage" && (
            <span className={isNonVeg(product) ? "food-type non-veg" : "food-type veg"}>
              {isNonVeg(product) ? <Flame size={9} /> : <Leaf size={9} />}
              {isNonVeg(product) ? "Non-Veg" : "Veg"}
            </span>
          )}
          {product.isRecommended && <span className="recommended-chip"><Sparkles size={9} /> Best</span>}
          {Number(product.offerPercent || 0) > 0 && (
            <span className="foodora-offer-ribbon"><BadgePercent size={11} /> {product.offerPercent}% OFF</span>
          )}
        </div>
        <div className="foodora-card-info">
          <span className="foodora-card-category">{product.category || "Recommended"}</span>
          <h2>{product.name}</h2>
          {Number(product.ratingCount || 0) > 0 && (
            <span className="foodora-card-rating">
              <Sparkles size={11} /> {Number(product.ratingAvg).toFixed(1)} ({product.ratingCount})
            </span>
          )}
          {product.description && <p>{product.description}</p>}
          <div className="foodora-card-foot">
            {Number(product.offerPercent || 0) > 0 ? (
              <span className="foodora-card-price">
                <strong>Rs {(Number(product.mrp || product.sellingPrice || 0) * (1 - product.offerPercent / 100)).toFixed(2)}</strong>
                <s>Rs {Number(product.mrp || product.sellingPrice || 0).toFixed(2)}</s>
              </span>
            ) : (
              <strong>Rs {Number(product.mrp || product.sellingPrice || 0).toFixed(2)}</strong>
            )}
            <div className="menu-add-control">
              {cartItem ? (
                <>
                  <button onClick={() => updateCart(product, -1)} title="Remove one">
                    <Minus size={16} />
                  </button>
                  <b>{cartItem.qty}</b>
                  <button onClick={() => updateCart(product, 1)} title="Add one">
                    <Plus size={16} />
                  </button>
                </>
              ) : (
                <button onClick={() => updateCart(product, 1)}>Add</button>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderMenuSection = (title, type, categoryMap) => {
    const categoryGroups = Object.entries(categoryMap);
    if (categoryGroups.length === 0) return null;

    return (
      <section className={`customer-menu-section ${type}`}>
        <div className="customer-menu-section-head">
          <h2>{title}</h2>
          <span>{categoryGroups.reduce((sum, [, list]) => sum + list.length, 0)} items</span>
        </div>

        {categoryGroups.map(([category, categoryProducts]) => (
          <div className="customer-category-block" key={`${type}-${category}`}>
            <div className="customer-category-head">
              <h3>{category}</h3>
              <span>{categoryProducts.length}</span>
            </div>
            <div className="foodora-product-grid">
              {categoryProducts.map((product, index) => renderProductCard(product, index))}
            </div>
          </div>
        ))}
      </section>
    );
  };

  return (
    <div className={`customer-menu-page ${checkoutStep === "details" ? "checkout-open" : ""}`}>
      <ToastViewport toast={toast} />

      {menuLoading && (
        <div className="customer-page-preloader">
          <span className="customer-page-spinner" />
          <p>Loading menu...</p>
        </div>
      )}

      <header className="foodora-topbar">
        <div className="foodora-topbar-inner">
          <div className="foodora-brand">
            <Utensils size={20} />
            <span>BhojanMitra</span>
          </div>
          <div className="foodora-location">
            <span>{isDelivery ? "Delivery" : `Table ${tableNo}`}</span>
          </div>
          <div className="menu-search">
            <Search size={18} />
            <input
              placeholder="Search food items, category, taste..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {customerAuth.token ? (
            <button type="button" className="foodora-profile-chip" onClick={() => setProfileModalOpen(true)}>
              <UserCircle2 size={18} />
              <span>{customerAuth.profile?.name?.split(" ")[0] || "Profile"}</span>
            </button>
          ) : (
            <button type="button" className="foodora-login-chip" onClick={() => setAuthModalOpen(true)}>
              <UserCircle2 size={18} />
              <span>Login</span>
            </button>
          )}

          <div className="foodora-cart-chip">
            <ShoppingBag size={18} />
            <b>{cartQty}</b>
          </div>
        </div>
      </header>

      <section className="foodora-hero">
        <div className="foodora-hero-text">
          <h1>
            {isDelivery ? "Delicious food," : "Delicious food,"} <span>{isDelivery ? "delivered fast" : "served fresh"}</span>
          </h1>
          <p>{isDelivery ? "Place your delivery order from this QR. Delivery details are required." : "Select items from the fresh menu. Your order will go directly to the counter."}</p>
          <button type="button" onClick={startCheckout}>
            Order Now <ShoppingBag size={16} />
          </button>
        </div>
        <div className="foodora-hero-deal">
          <span><Sparkles size={14} /> Your cart</span>
          <strong>Rs {payableTotal.toFixed(2)}</strong>
          <p>{cartQty} items added</p>
        </div>
      </section>

      {offerProducts.length > 0 && (
        <section className="foodora-offers-strip">
          <div className="foodora-offers-head">
            <BadgePercent size={16} />
            <h2>Offers for you</h2>
          </div>
          <div className="foodora-offers-row">
            {offerProducts.map((product) => (
              <button
                key={product._id}
                type="button"
                className="foodora-offer-card"
                onClick={() => {
                  setActiveCategory(product.category || "Recommended");
                  setSearch("");
                }}
              >
                <div className="foodora-offer-card-media">
                  {product.image ? <img src={product.image} alt={product.name} /> : <span>{product.name?.slice(0, 1) || "M"}</span>}
                  <b>{product.offerPercent}% OFF</b>
                </div>
                <span>{product.name}</span>
                <small>
                  Rs {(Number(product.mrp || product.sellingPrice || 0) * (1 - product.offerPercent / 100)).toFixed(0)}{" "}
                  <s>Rs {Number(product.mrp || product.sellingPrice || 0).toFixed(0)}</s>
                </small>
              </button>
            ))}
          </div>
        </section>
      )}

      {orderPlaced && (
        <section className={`order-tracking-panel ${orderPlaced.status}`}>
          <div className="order-placed-animation">
            <PublicLottie path="/order_placed.json" loop={false} />
          </div>
          <div className="order-tracking-head">
            <div>
              <span>{orderPlaced.orderNo}</span>
              <h2>
                {orderPlaced.status === "cancelled"
                  ? "Order cancelled"
                  : orderPlaced.status === "served"
                    ? "Order served"
                    : "Order status"}
              </h2>
              <p>{orderPlaced.orderType === "delivery" ? "Delivery order" : `Table ${orderPlaced.tableNo}`} | Live updates will appear here.</p>
            </div>
            <b>{orderPlaced.status}</b>
          </div>

          <div className="customer-status-timeline">
            {statusSteps.map((step, index) => {
              const Icon = step.icon;
              const done = currentStatusRank >= index;

              return (
                <div className={done ? "done" : ""} key={step.key}>
                  <i><Icon size={18} /></i>
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </div>
              );
            })}
          </div>

          {orderPlaced.status === "cancelled" && (
            <p className="customer-order-cancelled">
              Sorry, the restaurant cancelled this order. Please contact the staff.
            </p>
          )}

          <div className="customer-order-items">
            {orderPlaced.items?.map((item, index) => (
              <p key={`${item.productId}-${index}`}>
                <span>{item.qty} x {item.name}</span>
                <b>Rs {Number(item.total || 0).toFixed(2)}</b>
              </p>
            ))}
          </div>

          {orderPlaced.status === "served" && (
            <div className="customer-rating-box">
              {ratingSubmitted ? (
                <p className="rating-thanks"><CheckCircle2 size={16} /> Thanks for rating your order!</p>
              ) : (
                <>
                  <h3>Rate your order</h3>
                  <div className="customer-rating-items">
                    {orderPlaced.items?.map((item, index) => (
                      <div className="customer-rating-row" key={`${item.productId}-${index}`}>
                        <span>{item.name}</span>
                        <div className="customer-rating-stars">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              className={(itemRatings[item.productId] || 0) >= star ? "star-active" : ""}
                              onClick={() => setItemRatings((prev) => ({ ...prev, [item.productId]: star }))}
                            >
                              <Star size={18} fill={(itemRatings[item.productId] || 0) >= star ? "currentColor" : "none"} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="submit-rating-btn" disabled={submittingRating} onClick={submitRatings}>
                    {submittingRating ? "Submitting..." : "Submit Rating"}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <section className="foodora-categories">
        <div className="foodora-categories-head">
          <h2>Categories</h2>
          <div className="food-filter-tabs">
            <button
              className={activeFoodType === "all" ? "active" : ""}
              onClick={() => setActiveFoodType("all")}
              type="button"
            >
              All
            </button>
            <button
              className={activeFoodType === "veg" ? "active veg" : ""}
              onClick={() => setActiveFoodType("veg")}
              type="button"
            >
              <Leaf size={16} />
              Veg
            </button>
            <button
              className={activeFoodType === "non-veg" ? "active non-veg" : ""}
              onClick={() => setActiveFoodType("non-veg")}
              type="button"
            >
              <Flame size={16} />
              Non Veg
            </button>
          </div>
        </div>

        <nav className="foodora-categories-row">
          {categoryStats.map((category, index) => {
            const hue = ["#fff1e6", "#fef2f2", "#eef2ff", "#ecfdf5", "#fdf4ff", "#fefce8"][index % 6];
            return (
              <button
                key={category.name}
                className={activeCategory === category.name ? "active" : ""}
                onClick={() => setActiveCategory(category.name)}
                type="button"
              >
                <span className="foodora-cat-icon" style={{ backgroundColor: hue }}>
                  <Soup size={22} />
                </span>
                <b>{category.name}</b>
                <small>{category.count} items</small>
              </button>
            );
          })}
        </nav>
      </section>

      <main className="menu-layout">
        <section className="order-menu-browser">
          <div className="customer-items-pane">
            {renderMenuSection("Veg Menu", "veg", groupedMenu.veg)}
            {renderMenuSection("Non-Veg Menu", "non-veg", groupedMenu.nonVeg)}
            {visibleProducts.length === 0 && (
              <div className="restaurant-empty compact">No menu item found.</div>
            )}
          </div>
        </section>

        <aside className="menu-cart-panel" ref={cartPanelRef}>
          <div className="menu-cart-head">
            <ShoppingBag size={19} />
            <h2>Your Order</h2>
          </div>

          {customerAuth.token && (
            <div className="verified-customer-strip">
              <span className="verified-customer-badge">
                <ShieldCheck size={14} /> You are our Verified Customer
              </span>
              {isDelivery && (
                <button type="button" onClick={fetchOrderHistory}>
                  <History size={13} /> My Orders
                </button>
              )}
              <button type="button" onClick={fetchMyRewards}>
                <Gift size={13} /> My Rewards
              </button>
            </div>
          )}

          {historyOpen && orderHistory && (
            <div className="order-history-list">
              {orderHistory.length === 0 ? (
                <p>No past delivery orders yet.</p>
              ) : (
                orderHistory.map((order) => (
                  <div key={order._id}>
                    <span>{order.orderNo}</span>
                    <b>Rs {Number(order.grandTotal || 0).toFixed(2)}</b>
                    <small className={`status-tag ${order.status}`}>{order.status}</small>
                  </div>
                ))
              )}
            </div>
          )}

          {rewardsOpen && rewardsList && (
            <div className="order-history-list">
              {rewardsList.length === 0 ? (
                <p>No rewards yet -- complete a delivery order to win one.</p>
              ) : (
                rewardsList.map((reward) => (
                  <div key={reward.id}>
                    <span>{reward.title}</span>
                    <b>{reward.scratched ? reward.offerText : "Not opened"}</b>
                    <small className={`status-tag ${reward.expired ? "cancelled" : "served"}`}>
                      {reward.expired ? "Expired" : `Till ${new Date(reward.expiresAt).toLocaleDateString("en-IN")}`}
                    </small>
                  </div>
                ))
              )}
            </div>
          )}

          {cart.length === 0 ? (
            <p className="empty-cart-copy">Add items from the menu.</p>
          ) : (
            <div className="menu-cart-items">
              {cart.map((item) => (
                <div key={item.productId}>
                  <span>{item.name}</span>
                  <span className="cart-item-price">
                    {item.offerPercent > 0 && (
                      <>
                        <s>Rs {Number(item.originalRate).toFixed(2)}</s>
                        <small className="cart-item-offer">{item.offerPercent}% OFF</small>
                      </>
                    )}
                    <b>{item.qty} x Rs {Number(item.rate).toFixed(2)}</b>
                  </span>
                </div>
              ))}
            </div>
          )}

          {checkoutStep === "details" && (
            <div className="customer-details-step">
              <div className="checkout-step-head">
                <button type="button" onClick={() => setCheckoutStep("cart")}>Back</button>
                <span>Final details</span>
              </div>

              {!isDelivery && !customerAuth.token && (
                <button type="button" className="optional-login-banner" onClick={() => setOptionalLoginOpen((v) => !v)}>
                  <Gift size={16} />
                  <span>Save your order &amp; earn rewards -- Login with email (optional)</span>
                </button>
              )}

              <input
                placeholder="Customer name *"
                value={customer.customerName}
                onChange={(e) => setCustomer({ ...customer, customerName: e.target.value })}
              />
              <PhoneInput
                placeholder="Contact number"
                value={customer.customerPhone}
                onChange={(value) => {
                  setCustomer({ ...customer, customerPhone: value });
                  setPhoneOtp({ sent: false, code: "", verified: false, sending: false, verifying: false });
                }}
                required
              />

              {isDelivery && (
                <div className="otp-verify-box">
                  <div className="otp-verify-head">
                    <Phone size={15} /> <span>Phone verification</span>
                    {isPhoneVerified && <b className="otp-verified-tag"><ShieldCheck size={13} /> Verified</b>}
                  </div>
                  {!isPhoneVerified && (
                    <div className="otp-verify-row">
                      {!phoneOtp.sent ? (
                        <button type="button" disabled={phoneOtp.sending} onClick={sendPhoneOtpHandler}>
                          {phoneOtp.sending ? "Sending..." : "Send OTP"}
                        </button>
                      ) : (
                        <>
                          <input
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Enter OTP"
                            value={phoneOtp.code}
                            onChange={(e) => setPhoneOtp((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, "") }))}
                          />
                          <button type="button" disabled={phoneOtp.verifying} onClick={verifyPhoneOtpHandler}>
                            {phoneOtp.verifying ? "Checking..." : "Verify"}
                          </button>
                          <button type="button" className="otp-resend-btn" disabled={phoneOtp.sending} onClick={sendPhoneOtpHandler}>
                            Resend
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <div id="recaptcha-container" />
                </div>
              )}

              <input
                placeholder={isDelivery ? "Email *" : "Email optional"}
                value={customer.customerEmail}
                onChange={(e) => {
                  setCustomer({ ...customer, customerEmail: e.target.value });
                  setEmailOtp({ sent: false, code: "", verified: false, sending: false, verifying: false });
                }}
              />

              {(isDelivery || optionalLoginOpen) && !customerAuth.token && (
                <div className="otp-verify-box">
                  <div className="otp-verify-head">
                    <Mail size={15} /> <span>Email verification</span>
                    {isEmailVerified && <b className="otp-verified-tag"><ShieldCheck size={13} /> Verified</b>}
                  </div>
                  {!isEmailVerified && (
                    <div className="otp-verify-row">
                      {!emailOtp.sent ? (
                        <button type="button" disabled={emailOtp.sending} onClick={sendEmailOtpHandler}>
                          {emailOtp.sending ? "Sending..." : "Send OTP"}
                        </button>
                      ) : (
                        <>
                          <input
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Enter OTP"
                            value={emailOtp.code}
                            onChange={(e) => setEmailOtp((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, "") }))}
                          />
                          <button type="button" disabled={emailOtp.verifying} onClick={verifyEmailOtpHandler}>
                            {emailOtp.verifying ? "Checking..." : "Verify"}
                          </button>
                          <button type="button" className="otp-resend-btn" disabled={emailOtp.sending} onClick={sendEmailOtpHandler}>
                            Resend
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isDelivery && savedAddresses.length > 0 && (
                <div className="saved-address-chips">
                  {savedAddresses.map((addr, index) => (
                    <button
                      type="button"
                      key={index}
                      className={customer.deliveryAddress === addr.address ? "active" : ""}
                      onClick={() => setCustomer({ ...customer, deliveryAddress: addr.address })}
                    >
                      <MapPin size={13} /> {addr.label}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                placeholder={isDelivery ? "Delivery address *" : "Address optional"}
                value={customer.deliveryAddress}
                onChange={(e) => setCustomer({ ...customer, deliveryAddress: e.target.value })}
              />

              {isDelivery && customerAuth.token && customer.deliveryAddress.trim() && (
                <div className="save-address-row">
                  <select value={addressLabel} onChange={(e) => setAddressLabel(e.target.value)}>
                    <option value="Home">Home</option>
                    <option value="Work">Work</option>
                    <option value="Other">Other</option>
                  </select>
                  <button type="button" disabled={addingAddress} onClick={saveAddressHandler}>
                    {addingAddress ? "Saving..." : "Save this address"}
                  </button>
                </div>
              )}
              <textarea
                placeholder="Cooking note optional"
                value={customer.note}
                onChange={(e) => setCustomer({ ...customer, note: e.target.value })}
              />

              <div className="customer-coupon-box">
                <div className="menu-cart-head">
                  <BadgePercent size={18} />
                  <h2>Coupon</h2>
                </div>
                <div className="coupon-apply-row">
                  <input
                    placeholder="Coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={Boolean(coupon)}
                  />
                  {coupon ? (
                    <button type="button" onClick={removeCoupon}>Remove</button>
                  ) : (
                    <button type="button" disabled={applyingCoupon} onClick={applyCoupon}>
                      {applyingCoupon ? "Checking" : "Apply"}
                    </button>
                  )}
                </div>
                {coupon && (
                  <p>
                    <span>{coupon.code}</span>
                    <b>- Rs {discountAmount.toFixed(2)}</b>
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="menu-total-lines">
            <p><span>{gstAmount > 0 ? "Base Price" : "Price"}</span><b>Rs {subTotal.toFixed(2)}</b></p>
            {gstAmount > 0 && <p><span>GST Included</span><b>Rs {gstAmount.toFixed(2)}</b></p>}
            {discountAmount > 0 && <p><span>Coupon Discount</span><b>- Rs {discountAmount.toFixed(2)}</b></p>}
            <h3><span>Total</span><b>Rs {payableTotal.toFixed(2)}</b></h3>
          </div>

          {checkoutStep === "cart" ? (
            <button disabled={cart.length === 0} onClick={startCheckout}>
              Continue
            </button>
          ) : (
            <button
              disabled={placing || cart.length === 0 || (isDelivery && (!isEmailVerified || !isPhoneVerified))}
              onClick={placeOrder}
            >
              {placing ? "Sending..." : "Place Order"}
            </button>
          )}
        </aside>
      </main>

      {cart.length > 0 && !orderPlaced && (
        <div className="mobile-cart-cta">
          <div>
            <span>{cartQty} items</span>
            <strong>Rs {payableTotal.toFixed(2)}</strong>
          </div>
          {checkoutStep === "cart" ? (
            <button type="button" onClick={startCheckout}>
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={placing || (isDelivery && (!isEmailVerified || !isPhoneVerified))}
              onClick={placeOrder}
            >
              {placing ? "Sending..." : "Place Order"}
            </button>
          )}
        </div>
      )}

      {pendingReward && (
        <ScratchCard
          title={pendingReward.title}
          offerText={pendingReward.offerText}
          expiresAt={pendingReward.expiresAt}
          onReveal={scratchRewardHandler}
          onClose={() => setPendingReward(null)}
        />
      )}

      {couponSavedPopup && (
        <div className="coupon-saved-overlay" onClick={() => setCouponSavedPopup(null)}>
          <div className="coupon-saved-card" onClick={(e) => e.stopPropagation()}>
            <span className="coupon-confetti c1">🎉</span>
            <span className="coupon-confetti c2">✨</span>
            <span className="coupon-confetti c3">🎊</span>
            <span className="coupon-confetti c4">✨</span>
            <div className="coupon-saved-icon"><PartyPopper size={30} /></div>
            <h2>You saved Rs {couponSavedPopup.amount.toFixed(0)}!</h2>
            <p>Coupon <b>{couponSavedPopup.code}</b> applied successfully.</p>
            <button type="button" onClick={() => setCouponSavedPopup(null)}>Yay, Continue</button>
          </div>
        </div>
      )}

      {authModalOpen && (
        <div className="customer-auth-overlay" onClick={() => setAuthModalOpen(false)}>
          <div className="customer-auth-card" onClick={(e) => e.stopPropagation()}>
            <div className="customer-auth-head">
              <div>
                <h2>Login / Sign up</h2>
                <p>One email OTP logs you in -- new here? It creates your account automatically.</p>
              </div>
              <button type="button" onClick={() => setAuthModalOpen(false)}><X size={18} /></button>
            </div>

            <input
              placeholder="Your name *"
              value={customer.customerName}
              onChange={(e) => setCustomer({ ...customer, customerName: e.target.value })}
            />
            <PhoneInput
              placeholder="Contact number *"
              value={customer.customerPhone}
              onChange={(value) => setCustomer({ ...customer, customerPhone: value })}
            />
            <input
              placeholder="Email *"
              value={customer.customerEmail}
              onChange={(e) => {
                setCustomer({ ...customer, customerEmail: e.target.value });
                if (emailOtp.sent) setEmailOtp({ sent: false, code: "", verified: false, sending: false, verifying: false });
              }}
            />

            <div className="otp-verify-row">
              {!emailOtp.sent ? (
                <button
                  type="button"
                  disabled={emailOtp.sending}
                  onClick={sendEmailOtpHandler}
                >
                  {emailOtp.sending ? "Sending..." : "Send OTP"}
                </button>
              ) : (
                <>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter OTP"
                    value={emailOtp.code}
                    onChange={(e) => setEmailOtp((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, "") }))}
                  />
                  <button type="button" disabled={emailOtp.verifying} onClick={verifyEmailOtpHandler}>
                    {emailOtp.verifying ? "Checking..." : "Verify & Login"}
                  </button>
                  <button type="button" className="otp-resend-btn" disabled={emailOtp.sending} onClick={sendEmailOtpHandler}>
                    Resend
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {profileModalOpen && customerAuth.token && (
        <div className="customer-auth-overlay" onClick={() => setProfileModalOpen(false)}>
          <div className="customer-auth-card" onClick={(e) => e.stopPropagation()}>
            <div className="customer-auth-head">
              <div>
                <h2>{customerAuth.profile?.name || "My Profile"}</h2>
                <p>{customerAuth.profile?.contact} {customerAuth.profile?.email ? `· ${customerAuth.profile.email}` : ""}</p>
              </div>
              <button type="button" onClick={() => setProfileModalOpen(false)}><X size={18} /></button>
            </div>

            <div className="customer-profile-stats">
              <div>
                <span>Loyalty Points</span>
                <b>{customerAuth.profile?.loyaltyPoints || 0}</b>
              </div>
              <div>
                <span>Total Visits</span>
                <b>{customerAuth.profile?.totalVisits || 0}</b>
              </div>
            </div>

            <div className="verified-customer-strip">
              {isDelivery && (
                <button type="button" onClick={fetchOrderHistory}>
                  <History size={13} /> My Orders
                </button>
              )}
              <button type="button" onClick={fetchMyRewards}>
                <Gift size={13} /> My Rewards
              </button>
            </div>

            {historyOpen && orderHistory && (
              <div className="order-history-list">
                {orderHistory.length === 0 ? (
                  <p>No past delivery orders yet.</p>
                ) : (
                  orderHistory.map((order) => (
                    <div key={order._id}>
                      <span>{order.orderNo}</span>
                      <b>Rs {Number(order.grandTotal || 0).toFixed(2)}</b>
                      <small className={`status-tag ${order.status}`}>{order.status}</small>
                    </div>
                  ))
                )}
              </div>
            )}

            {rewardsOpen && rewardsList && (
              <div className="order-history-list">
                {rewardsList.length === 0 ? (
                  <p>No rewards yet -- complete a delivery order to win one.</p>
                ) : (
                  rewardsList.map((reward) => (
                    <div key={reward.id}>
                      <span>{reward.title}</span>
                      <b>{reward.scratched ? reward.offerText : "Not opened"}</b>
                      <small className={`status-tag ${reward.expired ? "cancelled" : "served"}`}>
                        {reward.expired ? "Expired" : `Till ${new Date(reward.expiresAt).toLocaleDateString("en-IN")}`}
                      </small>
                    </div>
                  ))
                )}
              </div>
            )}

            {savedAddresses.length > 0 && (
              <div className="customer-profile-addresses">
                <h3>Saved Addresses</h3>
                {savedAddresses.map((addr, index) => (
                  <p key={index}><MapPin size={13} /> <b>{addr.label}</b> -- {addr.address}</p>
                ))}
              </div>
            )}

            <button
              type="button"
              className="customer-logout-btn"
              onClick={() => {
                clearCustomerAuth();
                setProfileModalOpen(false);
              }}
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
