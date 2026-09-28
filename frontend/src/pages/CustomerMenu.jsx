import CustomerRewards from "../components/CustomerRewards";
import MenuItemDialog from "../components/MenuItemDialog";
import AsyncButton from "../components/AsyncButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgePercent, CheckCircle2, ChefHat, ChevronLeft, ChevronRight, Clock, Flame, Gift, Heart, History, Leaf, LogOut, Mail, MapPin, Minus, PackageCheck, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Star, UserCircle2, Utensils, X } from "lucide-react";
import { useParams } from "react-router-dom";
import API from "../api/axios";
import { categoryImageSrc, hasProductImage, productImageSrc } from "../api/productImage";
import { generatedCategoryImage } from "../data/categoryFoodImages";
import PhoneInput from "../components/PhoneInput";
import PublicLottie from "../components/PublicLottie";
import { ToastViewport, useToast } from "../components/Toast";
import ScratchCard from "../components/ScratchCard";
import StatusBadge from "../components/StatusBadge";

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
// that lifetime, and keying by branch + table keeps separate QR tables (and the
// same table number at two branches) from mixing carts.
const cartStorageKey = (cartKey) => `bhojan_cart_${cartKey}`;

// Fixed (not random) so the burst looks the same on every render.
const COUPON_CONFETTI = [
  ["8%", "#fbbf24", "0s", "-40px", "-18deg"], ["18%", "#ffffff", "0.08s", "-60px", "24deg"],
  ["27%", "#f472b6", "0.16s", "-30px", "-32deg"], ["36%", "#34d399", "0.04s", "-70px", "40deg"],
  ["45%", "#fbbf24", "0.2s", "-50px", "-12deg"], ["54%", "#ffffff", "0.12s", "-80px", "28deg"],
  ["63%", "#f472b6", "0.02s", "-45px", "-36deg"], ["72%", "#34d399", "0.18s", "-65px", "18deg"],
  ["81%", "#fbbf24", "0.1s", "-35px", "-24deg"], ["90%", "#ffffff", "0.06s", "-55px", "34deg"],
].map(([left, color, delay, rise, spin]) => ({ left, background: color, animationDelay: delay, "--rise": rise, "--spin": spin }));

const orderHistoryMeta = (order) => {
  const type =
    order.orderType === "delivery" ? "Delivery"
    : order.orderType === "takeaway" ? "Takeaway"
    : `Dine-in${order.tableNo ? ` · Table ${order.tableNo}` : ""}`;
  const date = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";
  return [type, date].filter(Boolean).join(" · ");
};

const loadStoredCart = (cartKey) => {
  try {
    return JSON.parse(sessionStorage.getItem(cartStorageKey(cartKey)) || "[]");
  } catch {
    return [];
  }
};

export default function CustomerMenu() {
  // /menu/<branchCode>/<table>; legacy QR codes (/menu/<table>) have no branch code
  // and are served by the main branch. The branch code reaches the API via axios.js.
  const { branchCode, tableNo } = useParams();
  const cartKey = `${branchCode || "main"}_${tableNo}`;
  const isDelivery = tableNo === "delivery";
  const [products, setProducts] = useState([]);
  // Item offers (buy-one-get-one, free combo item) -- separate from the
  // bill-level coupons held in `offers`.
  const [menuOffers, setMenuOffers] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categoryImages, setCategoryImages] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [branchName, setBranchName] = useState("");
  // Set when the outlet is on hold / removed: ordering is blocked server-side too.
  const [closedMessage, setClosedMessage] = useState("");
  const [cart, setCart] = useState(() => loadStoredCart(cartKey));
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeFoodType, setActiveFoodType] = useState("all");
  const [checkoutStep, setCheckoutStep] = useState("cart");
  const [search, setSearch] = useState("");
  const [favoriteItems, setFavoriteItems] = useState(() => new Set());
  const [offers, setOffers] = useState([]);
  const couponRequest = useRef(0);
  const couponBusy = useRef(false);
  const orderBusy = useRef(false);
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
  // Shown inside the coupon box (with a shake) when a code is rejected.
  const [couponError, setCouponError] = useState("");
  // Order-level review: food, restaurant and (delivery orders) the delivery.
  const [orderReview, setOrderReview] = useState({ food: 0, restaurant: 0, delivery: 0, comment: "" });
  const cartPanelRef = useRef(null);
  const categoryRowRef = useRef(null);
  const menuBrowserRef = useRef(null);
  const trackingRef = useRef(null);
  const [categoryScroll, setCategoryScroll] = useState({ left: false, right: false });
  const { toast, showToast } = useToast();

  // Email verification state for delivery checkout.
  const [emailOtp, setEmailOtp] = useState({ sent: false, code: "", verified: false, sending: false, verifying: false });
  const [verifiedEmail, setVerifiedEmail] = useState("");

  // Customer account (email-OTP login) -- persisted so a delivery customer isn't
  // asked to re-verify or retype their address on their next visit. Dine-in login
  // is optional (a "save my order & earn rewards" prompt, never required).
  const [customerAuth, setCustomerAuth] = useState({ token: "", profile: null });
  const [optionalLoginOpen, setOptionalLoginOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  // "otp" (email OTP, no password) or "password" (email/phone + password) --
  // alternate login/signup path, kept separate from the OTP-driven `customer` form fields.
  const [authMode, setAuthMode] = useState("otp");
  const [passwordAuth, setPasswordAuth] = useState({ mode: "login", identifier: "", password: "", loading: false });
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
        setCategoryImages(res.data.categoryImages || []);
        setOffers(res.data.offers || []);
        setMenuOffers(res.data.menuOffers || []);
        setBranchName(res.data.branch?.name || "");
      } catch (error) {
        if ([404, 423].includes(error.response?.status)) {
          setClosedMessage(error.response.data?.message || "This outlet is not accepting orders right now.");
          return;
        }
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
      const updated = { ...pendingReward, ...res.data.reward, scratched: true };
      setPendingReward(updated);
      setRewardsList((current) => current?.map((reward) => reward.id === pendingReward.id ? updated : reward) ?? null);
    } catch (error) {
      throw error;
    }
  };

  const offerProducts = useMemo(
    () => products.filter((product) => Number(product.offerPercent || 0) > 0).slice(0, 10),
    [products]
  );

  // "My Orders" row -> open that order in the live tracking panel (status
  // timeline, items, and the review box once it is served).
  const openOrderStatus = async (orderId) => {
    try {
      const res = await API.get(`/restaurant-orders/${orderId}`);
      setOrderPlaced(res.data.order);
      setItemRatings({});
      setOrderReview({ food: 0, restaurant: 0, delivery: 0, comment: "" });
      setRatingSubmitted(false);
      setProfileModalOpen(false);
      window.setTimeout(() => trackingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (error) {
      showToast(error.response?.data?.message || "Could not open this order");
    }
  };

  const submitRatings = async () => {
    const isDeliveryOrder = orderPlaced.orderType === "delivery";
    if (!orderReview.food || !orderReview.restaurant || (isDeliveryOrder && !orderReview.delivery)) {
      return showToast(
        isDeliveryOrder ? "Please rate the order, the restaurant and the delivery" : "Please rate the order and the restaurant",
        "warning"
      );
    }
    const ratings = Object.entries(itemRatings)
      .filter(([, stars]) => stars > 0)
      .map(([productId, stars]) => ({ productId, stars }));

    setSubmittingRating(true);
    try {
      await API.post(`/restaurant-orders/${orderPlaced._id}/review`, {
        foodStars: orderReview.food,
        restaurantStars: orderReview.restaurant,
        deliveryStars: isDeliveryOrder ? orderReview.delivery : undefined,
        comment: orderReview.comment,
      });
      // Per-dish stars are optional extras on top of the order review.
      if (ratings.length > 0) await API.post(`/restaurant-orders/${orderPlaced._id}/rate`, { ratings });
      setRatingSubmitted(true);
      showToast("Thanks for your review!", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Could not submit your review");
    } finally {
      setSubmittingRating(false);
    }
  };

  const renderStarPicker = (value, onPick, label) => (
    <div className="customer-rating-stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          className={value >= star ? "star-active" : ""}
          onClick={() => onPick(star)}
        >
          <Star size={22} fill={value >= star ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );

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

  const updateCategoryScroll = useCallback(() => {
    const row = categoryRowRef.current;
    if (!row) return;
    setCategoryScroll({
      left: row.scrollLeft > 2,
      right: row.scrollLeft + row.clientWidth < row.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const row = categoryRowRef.current;
    if (!row) return;
    const frame = requestAnimationFrame(updateCategoryScroll);
    const observer = new ResizeObserver(updateCategoryScroll);
    observer.observe(row);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [categoryStats, updateCategoryScroll]);

  const scrollCategories = (direction) => {
    const row = categoryRowRef.current;
    row?.scrollBy({ left: direction * Math.max(140, row.clientWidth * 0.7), behavior: "smooth" });
  };

  const scrollToCart = () => {
    cartPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openCategory = (categoryName) => {
    setActiveCategory(categoryName);
    window.requestAnimationFrame(() => {
      menuBrowserRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

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

  const updateCart = (product, change, selection) => {
    // Only a brand-new line needs the options dialog; "+" on an item already in the
    // cart (product.fromCart) just bumps that line's qty with the same size/add-ons.
    if (change > 0 && !selection && !product.fromCart) { setSelectedProduct(product); return; }
    const lineKey = selection ? [product._id, selection.variantId, ...selection.addonIds.slice().sort()].join("|") : product.lineKey;
    if (orderBusy.current) return;
    couponRequest.current += 1;
    couponBusy.current = false;
    setApplyingCoupon(false);
    if (coupon) {
      setCoupon(null);
      showToast("Cart changed. Apply your coupon again to update the discount.", "warning");
    }

    setCart((current) => {
      const existing = current.find((item) => lineKey ? item.lineKey === lineKey : item.productId === product._id);

      if (!existing && change > 0) {
        const mrp = selection?.basePrice ?? Number(product.mrp || product.sellingPrice || 0);
        const offerPercent = Number(product.offerPercent || 0);
        const rate = selection?.rate ?? Math.round(mrp * (1 - Math.min(100, Math.max(0, offerPercent)) / 100) * 100) / 100;

        return [
          ...current,
          {
            productId: product._id,
            lineKey,
            variantId: selection?.variantId || "",
            addonIds: selection?.addonIds || [],
            name: selection?.name || product.name,
            hasImage: Boolean(product.hasImage || product.image),
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
          if (item !== existing) return item;
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
      sessionStorage.setItem(cartStorageKey(cartKey), JSON.stringify(cart));
    } catch {
      // Storage unavailable (e.g. private mode) -- cart just won't survive a refresh.
    }
  }, [cart, cartKey]);

  const normalizedEmail = customer.customerEmail.trim().toLowerCase();
  // A returning logged-in customer whose form still matches their saved profile
  // skips OTP entirely -- that's the "don't ask again" behaviour for repeat visits.
  const isReturningCustomer =
    Boolean(customerAuth.token) &&
    customerAuth.profile?.contact === customer.customerPhone &&
    customer.customerPhone !== "" &&
    (customerAuth.profile?.email === normalizedEmail || !normalizedEmail);
  const isEmailVerified = isReturningCustomer || (emailOtp.verified && verifiedEmail === normalizedEmail && normalizedEmail !== "");
  // Phone OTP verification is disabled for now (Firebase phone auth needs a
  // Blaze billing plan we haven't enabled yet) -- treat every phone as verified
  // so checkout isn't blocked. The disabled phone-OTP UI has no active handlers.
  const isPhoneVerified = true;
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

  const passwordLoginHandler = async () => {
    if (!passwordAuth.identifier.trim() || !passwordAuth.password) {
      return showToast("Enter your email/phone and password", "warning");
    }
    setPasswordAuth((prev) => ({ ...prev, loading: true }));
    try {
      const res = await API.post("/customer-auth/login", {
        identifier: passwordAuth.identifier.trim(),
        password: passwordAuth.password,
      });
      persistCustomerAuth(res.data.token, res.data.customer);
      setCustomer((prev) => ({
        ...prev,
        customerName: prev.customerName || res.data.customer.name || "",
        customerPhone: prev.customerPhone || res.data.customer.contact || "",
        customerEmail: prev.customerEmail || res.data.customer.email || "",
      }));
      setPasswordAuth({ mode: "login", identifier: "", password: "", loading: false });
      setAuthModalOpen(false);
      showToast("Logged in", "success");
    } catch (error) {
      setPasswordAuth((prev) => ({ ...prev, loading: false }));
      showToast(error.response?.data?.message || "Could not log in");
    }
  };

  const passwordSignupHandler = async () => {
    if (!customer.customerName.trim()) return showToast("Enter your name first", "warning");
    if (customer.customerPhone.length !== 10) return showToast("Enter a valid 10-digit phone first", "warning");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.customerEmail.trim())) {
      return showToast("Enter a valid email first", "warning");
    }
    if (passwordAuth.password.length < 6) return showToast("Password must be at least 6 characters", "warning");

    setPasswordAuth((prev) => ({ ...prev, loading: true }));
    try {
      const res = await API.post("/customer-auth/signup", {
        name: customer.customerName.trim(),
        phone: customer.customerPhone,
        email: customer.customerEmail.trim(),
        password: passwordAuth.password,
      });
      persistCustomerAuth(res.data.token, res.data.customer);
      setPasswordAuth({ mode: "login", identifier: "", password: "", loading: false });
      setAuthModalOpen(false);
      showToast("Account created", "success");
    } catch (error) {
      setPasswordAuth((prev) => ({ ...prev, loading: false }));
      showToast(error.response?.data?.message || "Could not create account");
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
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);

    // Refetch on every open so statuses (preparing -> served) are never stale.
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
    if (orderBusy.current || couponBusy.current) return;
    if (couponCode.trim() && !coupon) return showToast("Apply or remove the coupon before placing your order", "warning");
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

    orderBusy.current = true;
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
          items: cart.map((item) => ({ productId: item.productId, qty: item.qty, variantId: item.variantId || "", addonIds: item.addonIds || [] })),
        },
        customerAuth.token ? { headers: { Authorization: `Bearer ${customerAuth.token}` } } : undefined
      );

      setOrderPlaced(res.data.order);
      setItemRatings({});
      setOrderReview({ food: 0, restaurant: 0, delivery: 0, comment: "" });
      setRatingSubmitted(false);
      setCart([]);
      setCheckoutStep("cart");
      setCoupon(null);
      setCouponCode("");
      setOrderHistory(null);
      setHistoryOpen(false);
      // A logged-in customer keeps their name/phone/email/address prefilled for
      // next time; a guest gets a clean form.
      if (!customerAuth.token) {
        setCustomer({ customerName: "", customerPhone: "", customerEmail: "", deliveryAddress: "", note: "" });
        setEmailOtp({ sent: false, code: "", verified: false, sending: false, verifying: false });

        setVerifiedEmail("");

      } else {
        setCustomer((prev) => ({ ...prev, note: "" }));
      }
      showToast("Order sent to the counter", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Order could not be placed");
    } finally {
      orderBusy.current = false;
      setPlacing(false);
    }
  };

  const applyCoupon = async (selectedCode = couponCode) => {
    if (couponBusy.current || orderBusy.current) return;
    const code = selectedCode.trim().toUpperCase();
    setCouponCode(code);
    setCouponError("");
    if (!code) {
      setCouponError("Enter a coupon code");
      return showToast("Enter a coupon code", "warning");
    }
    if (grandTotal <= 0) return showToast("Add an item before applying a coupon", "warning");

    const requestId = ++couponRequest.current;
    couponBusy.current = true;
    setApplyingCoupon(true);

    try {
      const res = await API.post("/coupons/apply", {
        code,
        billAmount: grandTotal,
      });
      if (requestId !== couponRequest.current) return;
      const savedAmount = Number(res.data.discountAmount || 0);
      setCoupon({
        ...res.data.coupon,
        discountAmount: savedAmount,
      });
      setCouponSavedPopup({ code, amount: savedAmount });
      showToast("Coupon applied", "success");
    } catch (error) {
      if (requestId !== couponRequest.current) return;
      setCoupon(null);
      const message = error.response?.data?.message || "Coupon could not be applied";
      setCouponError(message);
      showToast(message);
    } finally {
      if (requestId === couponRequest.current) {
        couponBusy.current = false;
        setApplyingCoupon(false);
      }
    }
  };

  const removeCoupon = () => {
    if (orderBusy.current) return;
    couponRequest.current += 1;
    couponBusy.current = false;
    setApplyingCoupon(false);
    setCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  const startCheckout = () => {
    if (cart.length === 0) return showToast("Please add a menu item first", "warning");
    setCheckoutStep("details");
  };

  // Checkout popup: Esc closes it (unless the order is being sent) and the page
  // behind it stops scrolling.
  useEffect(() => {
    if (checkoutStep !== "details") return undefined;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape" && !orderBusy.current) setCheckoutStep("cart");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [checkoutStep]);

  const renderProductCard = (product, index) => {
    const matchingLines = cart.filter((item) => item.productId === product._id);
    const cartItem = matchingLines.length ? { qty: matchingLines.reduce((sum, item) => sum + item.qty, 0) } : null;
    // The card's +/- act on the most recently added line of this product.
    const lastLine = matchingLines[matchingLines.length - 1];
    const cartLineRef = lastLine ? { ...product, lineKey: lastLine.lineKey, fromCart: true } : product;
    const displayPrice = product.variants?.length ? Math.min(...product.variants.map((v) => Number(v.price))) : Number(product.mrp || product.sellingPrice || 0);
    const hue = ["#84091e", "#b3132c", "#7c3aed", "#0f766e", "#b45309"][index % 5];

    return (
      <article className="foodora-card group" key={product._id} onClick={(event) => { if (!event.target.closest("button")) setSelectedProduct(product); }}>
        <div className="foodora-card-media" style={{ backgroundColor: hasProductImage(product) ? "#ffffff" : hue }}>
          {hasProductImage(product) ? (
            <img src={productImageSrc(product)} alt={product.name} loading="lazy" />
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
          <button
            type="button"
            className={`foodora-favorite-btn ${favoriteItems.has(product._id) ? "active" : ""}`}
            aria-label={favoriteItems.has(product._id) ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
            aria-pressed={favoriteItems.has(product._id)}
            onClick={() => setFavoriteItems((current) => {
              const next = new Set(current);
              if (next.has(product._id)) next.delete(product._id);
              else next.add(product._id);
              return next;
            })}
          >
            <Heart size={18} fill={favoriteItems.has(product._id) ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="foodora-card-info">
          <span className="foodora-card-category">{product.category || "Recommended"}</span>
          <h2><button className="menu-item-title" onClick={() => setSelectedProduct(product)}>{product.name}</button></h2>
          {Number(product.ratingCount || 0) > 0 && (
            <span className="foodora-card-rating">
              <Sparkles size={11} /> {Number(product.ratingAvg).toFixed(1)} ({product.ratingCount})
            </span>
          )}
          {product.description && <p>{product.description}</p>}
          {product.variants?.length > 0
            ? <small className="foodora-card-serving">{product.variants.length} sizes · starts from</small>
            : product.servingSize && <small className="foodora-card-serving">{product.servingSize}</small>}
          <div className="foodora-card-foot">
            {Number(product.offerPercent || 0) > 0 ? (
              <span className="foodora-card-price">
                <strong>₹{(displayPrice * (1 - product.offerPercent / 100)).toFixed(2)}</strong>
                <s>₹{displayPrice.toFixed(2)}</s>
              </span>
            ) : (
              <strong>₹{displayPrice.toFixed(2)}</strong>
            )}
            <div className="menu-add-control">
              {cartItem ? (
                <>
                  <button onClick={() => updateCart(cartLineRef, -1)} title="Remove one">
                    <Minus size={16} />
                  </button>
                  <b>{cartItem.qty}</b>
                  <button onClick={() => updateCart(cartLineRef, 1)} title="Add one">
                    <Plus size={16} />
                  </button>
                </>
              ) : (
                <button
                  className="menu-add-button"
                  onClick={() => updateCart(product, 1)}
                  title={`Add ${product.name}`}
                  aria-label={`Add ${product.name}`}
                >
                  <Plus size={18} />
                </button>
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
    <div className="customer-menu-page">
      {selectedProduct && <MenuItemDialog product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(selection) => { updateCart(selectedProduct, 1, selection); setSelectedProduct(null); }} />}
      {/* While the checkout popup is open its own notice bar shows toasts instead. */}
      {checkoutStep !== "details" && <ToastViewport toast={toast} />}

      {closedMessage && (
        <div className="customer-page-preloader" role="alert">
          <Utensils size={34} />
          <p>{closedMessage}</p>
        </div>
      )}

      {menuLoading && (
        <div className="customer-page-preloader">
          <span className="customer-page-spinner" />
          <p>Loading menu...</p>
        </div>
      )}

      <header className="foodora-topbar">
        <div className="foodora-topbar-inner">
          <div className="foodora-topbar-row">
            <div className="foodora-brand">
              <Utensils size={20} />
              <div className="foodora-brand-text">
                <span>{branchName || "RestroSethu"}</span>
                <small>{isDelivery ? "Delivery order" : `Table ${tableNo}`}</small>
              </div>
            </div>

            <div className="foodora-topbar-actions">
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

              <button
                type="button"
                className="foodora-cart-chip"
                onClick={scrollToCart}
                aria-label={`View your order (${cartQty} items)`}
              >
                <ShoppingBag size={18} />
                <b>{cartQty}</b>
              </button>
            </div>
          </div>

          <div className="menu-search">
            <Search size={18} />
            <input
              placeholder="Search food items, category, taste..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      {(offers.length > 0 || menuOffers.length > 0 || offerProducts.length > 0) && (
        <section className="menu-top-offers" aria-label="Top Offers">
          <div className="menu-top-offers-head">
            <span className="menu-top-offers-icon"><BadgePercent size={20} /></span>
            <div>
              <h2>Top Offers</h2>
              <p>Fresh deals from {branchName || "your restaurant"}, available today.</p>
            </div>
            <span className="menu-top-offers-count">{offers.length + menuOffers.length + offerProducts.length} deals</span>
          </div>
          <div className="menu-top-offers-row">
            {offers.map((offer) => (
              <article className="menu-top-offer" key={offer.code}>
                <BadgePercent className="menu-top-offer-stamp" aria-hidden="true" />
                <h3>{offer.title || (offer.discountType === "Percent" ? offer.discountValue + "% OFF" : "₹" + offer.discountValue + " OFF")}</h3>
                {offer.description && <p>{offer.description}</p>}
                <small>{offer.minimumBillAmount > 0 ? "On orders above ₹" + offer.minimumBillAmount : "No minimum order"}</small>
                <button type="button" disabled={placing || applyingCoupon || coupon?.code === offer.code}
                  onClick={() => {
                    if (grandTotal > 0) applyCoupon(offer.code);
                    else { setCouponCode(offer.code); showToast("Offer selected. Add items, then apply the code at checkout.", "success"); }
                  }}>
                  {coupon?.code === offer.code ? "Applied " : "Use Code "}<b>{offer.code}</b>
                </button>
              </article>
            ))}
            {menuOffers.map((offer) => {
              const product = products.find((row) => String(row._id) === String(offer.productId));
              return (
                <button
                  key={offer._id}
                  type="button"
                  className="menu-offer-card"
                  onClick={() => product && setSelectedProduct(product)}
                >
                  <span className="menu-offer-card-tag">
                    {offer.type === "bogo" ? "BUY 1 GET 1" : "FREE ITEM"}
                  </span>
                  <b>{offer.title}</b>
                  <small>
                    {offer.type === "bogo"
                      ? offer.productName
                      : `Free ${offer.freeSizeLabel ? `${offer.freeProductName} (${offer.freeSizeLabel})` : offer.freeProductName} with ${offer.productName}`}
                  </small>
                  {offer.sizeLabels.length > 0 && (
                    <span className="menu-offer-card-sizes">{offer.sizeLabels.join(" · ")}</span>
                  )}
                </button>
              );
            })}
            {offerProducts.map((product) => {
              const mrp = Number(product.mrp || product.sellingPrice || 0);
              const price = mrp * (1 - Number(product.offerPercent || 0) / 100);
              return (
                <button
                  key={product._id}
                  type="button"
                  className="menu-dish-offer"
                  onClick={() => setSelectedProduct(product)}
                  aria-label={`${product.name}, ${product.offerPercent}% off -- view dish`}
                >
                  {hasProductImage(product) ? (
                    <img src={productImageSrc(product)} alt="" loading="lazy" />
                  ) : (
                    <span className="menu-dish-offer-fallback">{product.name?.slice(0, 1) || "M"}</span>
                  )}
                  <span className="menu-dish-offer-tag">{product.offerPercent}% OFF</span>
                  <span className="menu-dish-offer-body">
                    <b>{product.name}</b>
                    <span className="menu-dish-offer-price">
                      ₹{price.toFixed(0)} <s>₹{mrp.toFixed(0)}</s>
                    </span>
                    <span className="menu-dish-offer-cta">Add to order <Plus size={14} /></span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {orderPlaced && (
        <section className={`order-tracking-panel ${orderPlaced.status}`} ref={trackingRef}>
          <button type="button" className="order-tracking-close" aria-label="Close order status" onClick={() => setOrderPlaced(null)}>
            <X size={18} />
          </button>
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
                    ? (orderPlaced.orderType === "delivery" ? "Order delivered" : "Order served")
                    : "Order status"}
              </h2>
              <p>{orderPlaced.orderType === "delivery" ? "Delivery order" : `Table ${orderPlaced.tableNo}`} | Live updates will appear here.</p>
            </div>
            <StatusBadge status={orderPlaced.status} orderType={orderPlaced.orderType} />
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
                <b>₹{Number(item.total || 0).toFixed(2)}</b>
              </p>
            ))}
          </div>

          {orderPlaced.status === "served" && (
            <div className="customer-rating-box">
              {ratingSubmitted ? (
                <p className="rating-thanks"><CheckCircle2 size={16} /> Thanks for rating your order!</p>
              ) : (
                <>
                  <h3>{orderPlaced.orderType === "delivery" ? "How was your delivery?" : "How was your order?"}</h3>
                  <p className="customer-review-intro">Your feedback helps us serve you better. No login needed.</p>

                  <div className="customer-review-rows">
                    {[
                      ["food", "Order & food", "Taste, quantity and freshness"],
                      ["restaurant", "Restaurant", "Service, packing and hygiene"],
                      ...(orderPlaced.orderType === "delivery" ? [["delivery", "Delivery partner", "Speed and behaviour"]] : []),
                    ].map(([key, title, hint]) => (
                      <div className="customer-review-row" key={key}>
                        <div>
                          <b>{title}</b>
                          <small>{hint}</small>
                        </div>
                        {renderStarPicker(orderReview[key], (star) => setOrderReview((prev) => ({ ...prev, [key]: star })), `Rate ${title}`)}
                      </div>
                    ))}
                  </div>

                  <textarea
                    className="customer-review-comment"
                    placeholder="Anything you'd like to tell us? (optional)"
                    maxLength={500}
                    value={orderReview.comment}
                    onChange={(e) => setOrderReview((prev) => ({ ...prev, comment: e.target.value }))}
                  />

                  <p className="customer-review-subhead">Rate the dishes (optional)</p>
                  <div className="customer-rating-items">
                    {orderPlaced.items?.map((item, index) => (
                      <div className="customer-rating-row" key={`${item.productId}-${index}`}>
                        <span>{item.name}</span>
                        {renderStarPicker(itemRatings[item.productId] || 0, (star) => setItemRatings((prev) => ({ ...prev, [item.productId]: star })), `Rate ${item.name}`)}
                      </div>
                    ))}
                  </div>
                  <AsyncButton type="button" className="submit-rating-btn" disabled={submittingRating} onClick={submitRatings}>
                    {submittingRating ? "Submitting..." : "Submit Review"}
                  </AsyncButton>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <section className="foodora-categories">
        <div className="foodora-categories-head">
          <h2>Categories</h2>
          <div className="category-head-actions">
            <div className="food-filter-tabs">
              <button className={activeFoodType === "all" ? "active" : ""} onClick={() => setActiveFoodType("all")} type="button">All</button>
              <button className={activeFoodType === "veg" ? "active veg" : ""} onClick={() => setActiveFoodType("veg")} type="button"><Leaf size={16} /> Veg</button>
              <button className={activeFoodType === "non-veg" ? "active non-veg" : ""} onClick={() => setActiveFoodType("non-veg")} type="button"><Flame size={16} /> Non Veg</button>
            </div>
            <div className="category-scroll-controls" aria-label="Scroll categories">
              <button type="button" aria-label="Previous categories" disabled={!categoryScroll.left}
                onClick={() => scrollCategories(-1)}><ChevronLeft size={19} /></button>
              <button type="button" aria-label="Next categories" disabled={!categoryScroll.right}
                onClick={() => scrollCategories(1)}><ChevronRight size={19} /></button>
            </div>
          </div>
        </div>

        <nav ref={categoryRowRef} onScroll={updateCategoryScroll} className="foodora-categories-row with-images" aria-label="Menu categories">
          {categoryStats.map((category) => (
              <button
                key={category.name}
                className={activeCategory === category.name ? "active" : ""}
                onClick={() => openCategory(category.name)}
                type="button"
                aria-label={`Show ${category.name} category`}
                title={category.name}
              >
                <span className="category-menu-thumbnail">
                  {(() => {
                    const saved = categoryImages.find((record) => record.name === category.name);
                    const generatedFallback = generatedCategoryImage(category.name);
                    const image = saved ? categoryImageSrc(saved) : generatedFallback;
                    return (
                      <>
                        {image && (
                          <img
                            src={image}
                            alt=""
                            loading="lazy"
                            onLoad={(event) => event.currentTarget.parentElement?.classList.remove("image-error")}
                            onError={(event) => {
                              if (saved && generatedFallback && !event.currentTarget.dataset.fallbackTried) {
                                event.currentTarget.dataset.fallbackTried = "true";
                                event.currentTarget.src = generatedFallback;
                                return;
                              }
                              event.currentTarget.parentElement?.classList.add("image-error");
                            }}
                          />
                        )}
                        <Utensils className="category-image-fallback" size={24} />
                      </>
                    );
                  })()}
                </span>
                <b>{category.name}</b>
              </button>
          ))}
        </nav>
      </section>

      <main className="menu-layout">
        <section className="order-menu-browser" ref={menuBrowserRef}>
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
            </div>
          )}


          {cart.length === 0 ? (
            <p className="empty-cart-copy">Add items from the menu.</p>
          ) : (
            <div className="menu-cart-items">
              {cart.map((item) => (
                <div key={item.lineKey || item.productId}>
                  <span>{item.name}</span>
                  <span className="cart-item-price">
                    {item.offerPercent > 0 && (
                      <>
                        <s>₹{Number(item.originalRate).toFixed(2)}</s>
                        <small className="cart-item-offer">{item.offerPercent}% OFF</small>
                      </>
                    )}
                    <b>{item.qty} x ₹{Number(item.rate).toFixed(2)}</b>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="menu-total-lines">
            <p><span>{gstAmount > 0 ? "Base Price" : "Price"}</span><b>₹{subTotal.toFixed(2)}</b></p>
            {gstAmount > 0 && <p><span>GST Included</span><b>₹{gstAmount.toFixed(2)}</b></p>}
            {discountAmount > 0 && <p><span>Coupon Discount</span><b>- ₹{discountAmount.toFixed(2)}</b></p>}
            <h3><span>Total</span><b>₹{payableTotal.toFixed(2)}</b></h3>
          </div>

          <button disabled={cart.length === 0} onClick={startCheckout}>
            Continue
          </button>
        </aside>
      </main>

      {cart.length > 0 && checkoutStep !== "details" && (
        <div className="mobile-cart-cta">
          <button type="button" className="mobile-cart-icon" onClick={scrollToCart} aria-label={`View your order (${cartQty} items)`}>
            <ShoppingBag size={20} />
            <b>{cartQty}</b>
          </button>
          <div>
            <span>{cartQty} items</span>
            <strong>₹{payableTotal.toFixed(2)}</strong>
          </div>
          <button type="button" onClick={startCheckout}>
            Continue
          </button>
        </div>
      )}

      {checkoutStep === "details" && cart.length > 0 && (
        <div className="checkout-modal-overlay" onClick={() => !placing && setCheckoutStep("cart")}>
          <div
            className="checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="checkout-modal-head">
              <div>
                <span>Almost done</span>
                <h2 id="checkout-modal-title">Final details</h2>
                <p>{cartQty} item{cartQty === 1 ? "" : "s"} · {isDelivery ? "Delivery order" : `Table ${tableNo}`}</p>
              </div>
              <button type="button" aria-label="Back to cart" disabled={placing} onClick={() => setCheckoutStep("cart")}>
                <X size={20} />
              </button>
            </div>

            {toast && (
              <div className={`checkout-modal-notice ${toast.type}`} role={toast.type === "success" ? "status" : "alert"} key={toast.id}>
                {toast.type === "success" ? <CheckCircle2 size={18} /> : <X size={18} />}
                <span>{toast.message}</span>
              </div>
            )}

            <div className="checkout-modal-body customer-details-step">
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

                }}
                required
              />

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
                        <AsyncButton type="button" disabled={emailOtp.sending} onClick={sendEmailOtpHandler}>
                          {emailOtp.sending ? "Sending..." : "Send OTP"}
                        </AsyncButton>
                      ) : (
                        <>
                          <input
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Enter OTP"
                            value={emailOtp.code}
                            onChange={(e) => setEmailOtp((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, "") }))}
                          />
                          <AsyncButton type="button" disabled={emailOtp.verifying} onClick={verifyEmailOtpHandler}>
                            {emailOtp.verifying ? "Checking..." : "Verify"}
                          </AsyncButton>
                          <AsyncButton type="button" className="otp-resend-btn" disabled={emailOtp.sending} onClick={sendEmailOtpHandler}>
                            Resend
                          </AsyncButton>
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
                  <AsyncButton type="button" disabled={addingAddress} onClick={saveAddressHandler}>
                    {addingAddress ? "Saving..." : "Save this address"}
                  </AsyncButton>
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
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError("");
                    }}
                    className={couponError ? "coupon-input-error" : ""}
                    disabled={Boolean(coupon) || applyingCoupon || placing}
                  />
                  {coupon ? (
                    <button type="button" disabled={placing} onClick={removeCoupon}>Remove</button>
                  ) : (
                    <AsyncButton type="button" disabled={applyingCoupon || placing} onClick={() => applyCoupon()}>
                      {applyingCoupon ? "Checking" : "Apply"}
                    </AsyncButton>
                  )}
                </div>
                {couponError && !coupon && (
                  <p className="coupon-inline-error" role="alert" key={couponError + (toast?.id || "")}>
                    <X size={14} /> {couponError}
                  </p>
                )}
                {!couponError && couponCode.trim() && !coupon && <p role="status">{applyingCoupon ? "Checking your coupon..." : "Apply this code before placing your order, or clear it to continue without a coupon."}</p>}
                {coupon && (
                  <p>
                    <span>{coupon.code}</span>
                    <b>- ₹{discountAmount.toFixed(2)}</b>
                  </p>
                )}
              </div>

              <div className="menu-total-lines">
                <p><span>{gstAmount > 0 ? "Base Price" : "Price"}</span><b>₹{subTotal.toFixed(2)}</b></p>
                {gstAmount > 0 && <p><span>GST Included</span><b>₹{gstAmount.toFixed(2)}</b></p>}
                {discountAmount > 0 && <p><span>Coupon Discount</span><b>- ₹{discountAmount.toFixed(2)}</b></p>}
                <h3><span>Total</span><b>₹{payableTotal.toFixed(2)}</b></h3>
              </div>
            </div>

            <div className="checkout-modal-foot">
              <button type="button" className="checkout-modal-back" disabled={placing} onClick={() => setCheckoutStep("cart")}>
                Back
              </button>
              <AsyncButton
                type="button"
                className="checkout-modal-place"
                disabled={placing || applyingCoupon || Boolean(couponCode.trim() && !coupon) || (isDelivery && (!isEmailVerified || !isPhoneVerified))}
                onClick={placeOrder}
              >
                {placing ? "Sending..." : `Place Order · ₹${payableTotal.toFixed(2)}`}
              </AsyncButton>
            </div>
          </div>
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
          <div className="coupon-saved-card" role="dialog" aria-modal="true" aria-label="Coupon applied" onClick={(e) => e.stopPropagation()}>
            <div className="coupon-confetti" aria-hidden="true">
              {COUPON_CONFETTI.map((piece, index) => (
                <i key={index} style={piece} />
              ))}
            </div>

            <div className="coupon-saved-top">
              <span className="coupon-saved-check"><CheckCircle2 size={26} /></span>
              <span className="coupon-saved-eyebrow">Coupon applied</span>
              <h2>
                <small>₹</small>{couponSavedPopup.amount.toFixed(0)}
              </h2>
              <p>saved on this order</p>
            </div>

            <div className="coupon-saved-cut" aria-hidden="true" />

            <div className="coupon-saved-bottom">
              <span className="coupon-saved-code">
                <BadgePercent size={16} /> {couponSavedPopup.code}
              </span>
              <p>The discount is already reflected in your bill.</p>
              <button type="button" autoFocus onClick={() => setCouponSavedPopup(null)}>Continue ordering</button>
            </div>
          </div>
        </div>
      )}

      {authModalOpen && (
        <div className="customer-auth-overlay" onClick={() => setAuthModalOpen(false)}>
          <div className="customer-auth-card" onClick={(e) => e.stopPropagation()}>
            <div className="customer-auth-head">
              <div>
                <h2>Login / Sign up</h2>
                <p>
                  {authMode === "otp"
                    ? "One email OTP logs you in -- new here? It creates your account automatically."
                    : passwordAuth.mode === "login"
                      ? "Log in with the email/phone and password you set earlier."
                      : "Create a password so you can log in directly next time, no OTP needed."}
                </p>
              </div>
              <button type="button" onClick={() => setAuthModalOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>

            <div className="auth-mode-tabs">
              <button type="button" className={authMode === "otp" ? "active" : ""} onClick={() => setAuthMode("otp")}>
                Email OTP
              </button>
              <button type="button" className={authMode === "password" ? "active" : ""} onClick={() => setAuthMode("password")}>
                Password
              </button>
            </div>

            {authMode === "otp" ? (
              <>
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
                    <AsyncButton
                      type="button"
                      disabled={emailOtp.sending}
                      onClick={sendEmailOtpHandler}
                    >
                      {emailOtp.sending ? "Sending..." : "Send OTP"}
                    </AsyncButton>
                  ) : (
                    <>
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter OTP"
                        value={emailOtp.code}
                        onChange={(e) => setEmailOtp((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, "") }))}
                      />
                      <AsyncButton type="button" disabled={emailOtp.verifying} onClick={verifyEmailOtpHandler}>
                        {emailOtp.verifying ? "Checking..." : "Verify & Login"}
                      </AsyncButton>
                      <AsyncButton type="button" className="otp-resend-btn" disabled={emailOtp.sending} onClick={sendEmailOtpHandler}>
                        Resend
                      </AsyncButton>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="auth-mode-tabs secondary">
                  <button type="button" className={passwordAuth.mode === "login" ? "active" : ""} onClick={() => setPasswordAuth((prev) => ({ ...prev, mode: "login" }))}>
                    Log in
                  </button>
                  <button type="button" className={passwordAuth.mode === "signup" ? "active" : ""} onClick={() => setPasswordAuth((prev) => ({ ...prev, mode: "signup" }))}>
                    Create account
                  </button>
                </div>

                {passwordAuth.mode === "signup" && (
                  <>
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
                      onChange={(e) => setCustomer({ ...customer, customerEmail: e.target.value })}
                    />
                    <input
                      type="password"
                      placeholder="Create a password (min 6 chars) *"
                      value={passwordAuth.password}
                      onChange={(e) => setPasswordAuth((prev) => ({ ...prev, password: e.target.value }))}
                    />
                    <AsyncButton type="button" disabled={passwordAuth.loading} onClick={passwordSignupHandler}>
                      {passwordAuth.loading ? "Creating..." : "Create account"}
                    </AsyncButton>
                  </>
                )}

                {passwordAuth.mode === "login" && (
                  <>
                    <input
                      placeholder="Email or phone *"
                      value={passwordAuth.identifier}
                      onChange={(e) => setPasswordAuth((prev) => ({ ...prev, identifier: e.target.value }))}
                    />
                    <input
                      type="password"
                      placeholder="Password *"
                      value={passwordAuth.password}
                      onChange={(e) => setPasswordAuth((prev) => ({ ...prev, password: e.target.value }))}
                    />
                    <AsyncButton type="button" disabled={passwordAuth.loading} onClick={passwordLoginHandler}>
                      {passwordAuth.loading ? "Logging in..." : "Log in"}
                    </AsyncButton>
                  </>
                )}
              </>
            )}
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
              <button type="button" onClick={() => setProfileModalOpen(false)} aria-label="Close"><X size={18} /></button>
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
              <AsyncButton type="button" onClick={fetchOrderHistory}>
                <History size={13} /> My Orders
              </AsyncButton>
              <AsyncButton type="button" onClick={fetchMyRewards}>
                <Gift size={13} /> My Rewards
              </AsyncButton>
            </div>

            {historyOpen && orderHistory && (
              <div className="order-history-list">
                {orderHistory.length === 0 ? (
                  <p>No past orders yet.</p>
                ) : (
                  orderHistory.map((order) => (
                    <button type="button" className="order-history-row" key={order._id} onClick={() => openOrderStatus(order._id)} aria-label={`View status of ${order.orderNo}`}>
                      <span className="order-history-id">{order.orderNo}<small>{orderHistoryMeta(order)}</small></span>
                      <b>₹{Number(order.grandTotal || 0).toFixed(2)}</b>
                      <StatusBadge status={order.status} orderType={order.orderType} className="!px-2 !py-0.5 !text-[10px]" />
                      <ChevronRight size={16} className="order-history-chevron" />
                    </button>
                  ))
                )}
              </div>
            )}

            {rewardsOpen && rewardsList && <CustomerRewards rewards={rewardsList} onOpen={setPendingReward} />}

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
