import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  Clock,
  Crown,
  Download,
  Plus,
  Receipt,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import API from "../api/axios";
import { ToastViewport, useToast } from "../components/Toast";

const chartColors = ["#e11d48", "#f59e0b", "#2563eb", "#7c3aed", "#0d9488"];
const categoryColors = ["#e11d48", "#f59e0b", "#2563eb", "#7c3aed", "#0d9488", "#db2777"];
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const tooltipContentStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 14px 34px rgba(15,23,42,0.14)",
  padding: "10px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#0f172a",
};
const tooltipLabelStyle = { color: "#64748b", fontWeight: 700, marginBottom: 4 };
const tooltipCursor = { fill: "rgba(148,163,184,0.12)" };
const axisTick = { fontSize: 11, fontWeight: 600, fill: "#94a3b8" };
const gridStroke = "#eef2f7";

const formatDateInput = (date) => date.toISOString().slice(0, 10);

const money = (value) =>
  `Rs ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const getOrderDate = (order) => new Date(order.payment?.paidAt || order.updatedAt || order.createdAt);

const isSameDay = (value, target) => {
  const date = new Date(value);
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
};

const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const getFinancialYearRange = (label) => {
  const startYear = Number(String(label).split("-")[0]);
  return {
    start: new Date(startYear, 3, 1, 0, 0, 0, 0),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
  };
};

const getLastDays = (count) => {
  const days = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    days.push(date);
  }

  return days;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [deletionLogs, setDeletionLogs] = useState([]);
  const [financialYear, setFinancialYear] = useState(getFinancialYear());
  const [filterMode, setFilterMode] = useState("fy");
  const [trendPeriod, setTrendPeriod] = useState("week");
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(formatDateInput(new Date()).slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [customRange, setCustomRange] = useState({
    start: formatDateInput(new Date()),
    end: formatDateInput(new Date()),
  });
  const { toast, showToast } = useToast();
  const [analytics, setAnalytics] = useState({
    lowStockRawMaterials: [],
    tablePerformance: [],
    topSelling: [],
    leastSelling: [],
    hourlyBreakdown: [],
  });

  useEffect(() => {
    API.get("/dashboard/analytics", { params: { filter: "month" } })
      .then((res) => {
        setAnalytics({
          lowStockRawMaterials: res.data.lowStockRawMaterials || [],
          tablePerformance: res.data.tablePerformance || [],
          topSelling: res.data.topSelling || [],
          leastSelling: res.data.leastSelling || [],
          hourlyBreakdown: res.data.hourlyBreakdown || [],
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [orderRes, itemRes, customerRes] = await Promise.all([
          API.get("/restaurant-orders"),
          API.get("/products"),
          API.get("/customers"),
        ]);

        if (!mounted) return;
        setOrders(orderRes.data.orders || orderRes.data || []);
        setItems(itemRes.data.products || itemRes.data || []);
        setCustomers(customerRes.data.customers || customerRes.data || []);
      } catch (error) {
        showToast(error.response?.data?.message || "Dashboard load failed");
      }

      try {
        const deletionRes = await API.get("/dashboard/deletions");
        if (!mounted) return;
        setDeletionLogs(deletionRes.data.logs || []);
      } catch {
        if (mounted) setDeletionLogs([]);
      }
    };

    fetchData();
    const timer = window.setInterval(fetchData, 15000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [showToast]);

  const financialYears = useMemo(() => {
    const years = new Set([getFinancialYear()]);
    orders.forEach((order) => years.add(getFinancialYear(new Date(order.createdAt))));
    return Array.from(years).sort((a, b) => Number(b.split("-")[0]) - Number(a.split("-")[0]));
  }, [orders]);

  const dateRange = useMemo(() => {
    const fyRange = getFinancialYearRange(financialYear);

    if (filterMode === "day") {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (filterMode === "month") {
      const [year, month] = selectedMonth.split("-").map(Number);
      return {
        start: new Date(year, month - 1, 1, 0, 0, 0, 0),
        end: new Date(year, month, 0, 23, 59, 59, 999),
      };
    }

    if (filterMode === "year") {
      const year = Number(selectedYear);
      return {
        start: new Date(year, 0, 1, 0, 0, 0, 0),
        end: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    }

    if (filterMode === "custom") {
      const start = new Date(customRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    return fyRange;
  }, [customRange, filterMode, financialYear, selectedDate, selectedMonth, selectedYear]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const date = getOrderDate(order);
      return date >= dateRange.start && date <= dateRange.end;
    });
  }, [dateRange, orders]);

  const paidOrders = useMemo(
    () => filteredOrders.filter((order) => order.paymentStatus === "paid"),
    [filteredOrders]
  );

  const stats = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const paidAll = orders.filter((order) => order.paymentStatus === "paid");
    const paidThisMonth = paidAll.filter((order) => {
      const date = getOrderDate(order);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
    const paidThisYear = paidAll.filter((order) => getOrderDate(order).getFullYear() === now.getFullYear());

    const selectedSale = paidOrders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
    const selectedCustomers = new Set(
      filteredOrders
        .map((order) => order.customerPhone || order.customerName || order.customerEmail)
        .filter(Boolean)
    );

    return {
      totalOrders: filteredOrders.length,
      totalSale: selectedSale,
      yesterdaySale: paidAll
        .filter((order) => isSameDay(getOrderDate(order), yesterday))
        .reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
      todaySale: paidAll
        .filter((order) => isSameDay(getOrderDate(order), now))
        .reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
      monthlySale: paidThisMonth.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
      yearlySale: paidThisYear.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
      totalCustomers: customers.length,
      totalItems: items.length,
      averageBill: paidOrders.length ? selectedSale / paidOrders.length : 0,
      cancelledOrders: filteredOrders.filter((order) => order.status === "cancelled").length,
      dineInOrders: filteredOrders.filter((order) => order.orderType !== "delivery").length,
      deliveryOrders: filteredOrders.filter((order) => order.orderType === "delivery").length,
      totalDelivery: orders.filter((order) => order.orderType === "delivery").length,
      activeCustomers: selectedCustomers.size,
      activeOrders: filteredOrders.filter((order) => !["served", "cancelled"].includes(order.status)).length,
    };
  }, [customers.length, filteredOrders, items.length, orders, paidOrders]);

  const topItems = useMemo(() => {
    const map = new Map();
    paidOrders.forEach((order) => {
      order.items?.forEach((item) => {
        const current = map.get(item.name) || { name: item.name, qty: 0, amount: 0 };
        current.qty += Number(item.qty || 0);
        current.amount += Number(item.total || 0);
        map.set(item.name, current);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 8);
  }, [paidOrders]);

  const peakHours = useMemo(() => {
    const map = new Map();
    paidOrders.forEach((order) => {
      const hour = getOrderDate(order).getHours();
      const label = `${String(hour).padStart(2, "0")}:00`;
      const current = map.get(label) || { name: label, orders: 0, sale: 0 };
      current.orders += 1;
      current.sale += Number(order.grandTotal || 0);
      map.set(label, current);
    });
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders).slice(0, 8);
  }, [paidOrders]);

  const peakDays = useMemo(() => {
    const map = new Map(dayNames.map((name) => [name, { name, orders: 0, sale: 0 }]));
    paidOrders.forEach((order) => {
      const day = dayNames[getOrderDate(order).getDay()];
      const current = map.get(day);
      current.orders += 1;
      current.sale += Number(order.grandTotal || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.sale - a.sale);
  }, [paidOrders]);

  const paymentData = useMemo(() => {
    const totals = { Cash: 0, UPI: 0, Card: 0 };
    paidOrders.forEach((order) => {
      totals.Cash += Number(order.payment?.cash || 0);
      totals.UPI += Number(order.payment?.upi || 0);
      totals.Card += Number(order.payment?.card || 0);
    });
    return Object.entries(totals)
      .map(([name, amount]) => ({ name, amount }))
      .filter((entry) => entry.amount > 0);
  }, [paidOrders]);

  const last20Days = useMemo(() => {
    return getLastDays(20).map((date) => {
      const dayOrders = orders.filter((order) => isSameDay(getOrderDate(order), date));
      const dayPaid = dayOrders.filter((order) => order.paymentStatus === "paid");
      return {
        name: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        orders: dayOrders.length,
        sale: dayPaid.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
      };
    });
  }, [orders]);

  const last7Days = useMemo(() => {
    return getLastDays(7).map((date) => {
      const dayOrders = orders.filter((order) => isSameDay(getOrderDate(order), date));
      const dayPaid = dayOrders.filter((order) => order.paymentStatus === "paid");
      const dayCustomers = new Set(
        dayOrders.map((order) => order.customerPhone || order.customerName || order.customerEmail).filter(Boolean)
      );
      return {
        name: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        orders: dayOrders.length,
        revenue: dayPaid.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
        customers: dayCustomers.size,
      };
    });
  }, [orders]);

  const revenueTrend = useMemo(() => {
    if (trendPeriod === "today") {
      const today = new Date();
      const buckets = Array.from({ length: 24 }, (_, hour) => ({
        name: `${String(hour % 12 === 0 ? 12 : hour % 12).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`,
        revenue: 0,
        orders: 0,
      }));
      orders.forEach((order) => {
        const date = getOrderDate(order);
        if (!isSameDay(date, today)) return;
        const hour = date.getHours();
        buckets[hour].orders += 1;
        if (order.paymentStatus === "paid") buckets[hour].revenue += Number(order.grandTotal || 0);
      });
      return buckets.filter((_, hour) => hour >= 6 && hour <= 23);
    }

    if (trendPeriod === "month") {
      return getLastDays(30).map((date) => {
        const dayOrders = orders.filter((order) => isSameDay(getOrderDate(order), date));
        const dayPaid = dayOrders.filter((order) => order.paymentStatus === "paid");
        return {
          name: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          revenue: dayPaid.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
          orders: dayOrders.length,
        };
      });
    }

    return last7Days.map((day) => ({ name: day.name, revenue: day.revenue, orders: day.orders }));
  }, [last7Days, orders, trendPeriod]);

  const trendStrip = useMemo(() => {
    const now = new Date();
    const todayRevenue = revenueTrend.length
      ? trendPeriod === "today"
        ? revenueTrend.reduce((sum, row) => sum + row.revenue, 0)
        : revenueTrend[revenueTrend.length - 1]?.revenue || 0
      : 0;
    const todayOrders = revenueTrend.length
      ? trendPeriod === "today"
        ? revenueTrend.reduce((sum, row) => sum + row.orders, 0)
        : revenueTrend[revenueTrend.length - 1]?.orders || 0
      : 0;
    const peakRevenueRow = revenueTrend.reduce(
      (best, row) => (row.revenue > (best?.revenue || 0) ? row : best),
      null
    );
    const peakOrdersRow = revenueTrend.reduce((best, row) => (row.orders > (best?.orders || 0) ? row : best), null);

    return {
      todayLabel: trendPeriod === "today" ? "Today's Revenue" : "Latest Revenue",
      todayRevenue,
      todayOrdersLabel: trendPeriod === "today" ? "Today's Orders" : "Latest Orders",
      todayOrders,
      peakRevenue: peakRevenueRow?.revenue || 0,
      peakRevenueLabel: peakRevenueRow?.name || "-",
      peakOrders: peakOrdersRow?.orders || 0,
      peakOrdersLabel: peakOrdersRow?.name || "-",
      now,
    };
  }, [revenueTrend, trendPeriod]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map();
    let totalOrders = 0;

    paidOrders.forEach((order) => {
      order.items?.forEach((item) => {
        const category = item.category || "Others";
        const current = map.get(category) || { name: category, orders: 0, revenue: 0 };
        current.orders += Number(item.qty || 0);
        current.revenue += Number(item.total || 0);
        map.set(category, current);
        totalOrders += Number(item.qty || 0);
      });
    });

    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const grandRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);

    return {
      rows: rows.map((row, index) => ({
        ...row,
        color: categoryColors[index % categoryColors.length],
        share: grandRevenue ? (row.revenue / grandRevenue) * 100 : 0,
      })),
      totalOrders,
    };
  }, [paidOrders]);

  const orderStatusBreakdown = useMemo(() => {
    const buckets = { Completed: 0, Preparing: 0, Pending: 0, Cancelled: 0 };
    filteredOrders.forEach((order) => {
      if (order.status === "cancelled") buckets.Cancelled += 1;
      else if (order.status === "served") buckets.Completed += 1;
      else if (order.status === "preparing") buckets.Preparing += 1;
      else buckets.Pending += 1;
    });

    const total = filteredOrders.length || 1;
    const colors = { Completed: "#22c55e", Preparing: "#f97316", Pending: "#3b82f6", Cancelled: "#ef4444" };

    return Object.entries(buckets).map(([name, value]) => ({
      name,
      value,
      percent: Math.round((value / total) * 100),
      color: colors[name],
    }));
  }, [filteredOrders]);

  const topDay = peakDays[0];

  const saleTrend = stats.yesterdaySale
    ? ((stats.todaySale - stats.yesterdaySale) / stats.yesterdaySale) * 100
    : stats.todaySale > 0
      ? 100
      : 0;

  const businessInsights = {
    topItem: topItems[0]?.name || "-",
    bestSeller: [...topItems].sort((a, b) => b.qty - a.qty)[0]?.name || "-",
    peakHour: peakHours[0]?.name || "-",
  };

  const downloadReport = () => {
    const rows = [["Order No", "Date", "Type", "Status", "Payment", "Total"]];
    filteredOrders.forEach((order) => {
      rows.push([
        order.orderNo || "-",
        getOrderDate(order).toLocaleString("en-IN"),
        order.orderType || "-",
        order.status || "-",
        order.paymentStatus || "-",
        Number(order.grandTotal || 0).toFixed(2),
      ]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-report-${formatDateInput(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Report downloaded", "success");
  };

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good Morning" : greetingHour < 17 ? "Good Afternoon" : "Good Evening";
  const todayLabel = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="dashboard-page restaurant-dashboard">
      <ToastViewport toast={toast} />

      <div className="dashboard-header restaurant-dashboard-header dashboard-greeting-header">
        <div>
          <span className="dashboard-greeting-date">{todayLabel}</span>
          <h1>{greeting}! 👋</h1>
          <p>Here's what's happening with your food business today.</p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="dashboard-btn-ghost" onClick={downloadReport}>
            <Download size={16} /> Download Report
          </button>
          <button type="button" className="dashboard-btn-solid" onClick={() => navigate("/menu-items")}>
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      <div className="dashboard-filter-card restaurant-dashboard-filters">
        <label>
          <span>Financial Year</span>
          <select value={financialYear} onChange={(e) => setFinancialYear(e.target.value)}>
            {financialYears.map((year) => (
              <option key={year} value={year}>
                FY {year}
              </option>
            ))}
          </select>
        </label>

        <div className="dashboard-filter-tabs">
          {[
            ["fy", "Full FY"],
            ["day", "Day"],
            ["month", "Month"],
            ["year", "Year"],
            ["custom", "Custom"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filterMode === value ? "active" : ""}
              onClick={() => setFilterMode(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {filterMode === "day" && (
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        )}
        {filterMode === "month" && (
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
        )}
        {filterMode === "year" && (
          <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} />
        )}
        {filterMode === "custom" && (
          <>
            <input
              type="date"
              value={customRange.start}
              onChange={(e) => setCustomRange((current) => ({ ...current, start: e.target.value }))}
            />
            <input
              type="date"
              value={customRange.end}
              onChange={(e) => setCustomRange((current) => ({ ...current, end: e.target.value }))}
            />
          </>
        )}
      </div>

      <div className="dashboard-stats-grid restaurant-kpi-grid four-col">
        <Kpi
          title="Total Revenue"
          value={money(stats.totalSale)}
          icon={Wallet}
          tone="orange"
          trend={saleTrend}
          trendLabel="vs Yesterday"
          sparkline={last7Days.map((d) => d.revenue)}
          sparklineColor="#e11d48"
        />
        <Kpi
          title="Total Orders"
          value={stats.totalOrders}
          icon={ShoppingBag}
          tone="blue"
          sparkline={last7Days.map((d) => d.orders)}
          sparklineColor="#3b82f6"
        />
        <Kpi
          title="New Customers"
          value={stats.activeCustomers}
          icon={Users}
          tone="green"
          sparkline={last7Days.map((d) => d.customers)}
          sparklineColor="#22c55e"
        />
        <Kpi
          title="Average Order Value"
          value={money(stats.averageBill)}
          icon={Receipt}
          tone="purple"
          sparkline={last7Days.map((d) => (d.orders ? d.revenue / d.orders : 0))}
          sparklineColor="#a855f7"
        />
      </div>

      <div className="dashboard-stats-grid restaurant-kpi-grid four-col">
        <Kpi title="Today Sale" value={money(stats.todaySale)} quiet />
        <Kpi title="Yesterday Sale" value={money(stats.yesterdaySale)} quiet />
        <Kpi title="Monthly Sale" value={money(stats.monthlySale)} quiet />
        <Kpi title="Yearly Sale" value={money(stats.yearlySale)} quiet />
      </div>

      <div className="dashboard-stats-grid restaurant-metric-grid">
        <Kpi title="Total Customer" value={stats.totalCustomers} quiet />
        <Kpi title="Total Items" value={stats.totalItems} quiet />
        <Kpi title="Average Bill" value={money(stats.averageBill)} quiet />
        <Kpi title="Cancelled Order" value={stats.cancelledOrders} quiet />
        <Kpi title="Dine In Order" value={stats.dineInOrders} quiet />
        <Kpi title="Delivery Order" value={stats.deliveryOrders} quiet />
        <Kpi title="Total Delivery" value={stats.totalDelivery} quiet />
        <Kpi title="Active Customer" value={stats.activeCustomers} quiet />
        <Kpi title="Active Order" value={stats.activeOrders} quiet />
        <Kpi title="Paid Order" value={paidOrders.length} quiet />
      </div>

      <div className="dashboard-main-grid">
        <div className="dashboard-chart-box dashboard-trend-card">
          <div className="dashboard-trend-head">
            <h2>Revenue &amp; Orders Trend</h2>
            <div className="dashboard-trend-tabs">
              {[
                ["today", "Today"],
                ["week", "This Week"],
                ["month", "This Month"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={trendPeriod === value ? "active" : ""}
                  onClick={() => setTrendPeriod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {revenueTrend.length === 0 ? (
            <p>No trend data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                <YAxis yAxisId="revenue" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis yAxisId="orders" orientation="right" tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value, name) => (name === "revenue" ? money(value) : value)}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  cursor={{ stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                <Area
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#e11d48"
                  strokeWidth={2.5}
                  fill="url(#revenueFill)"
                />
                <Line
                  yAxisId="orders"
                  type="monotone"
                  dataKey="orders"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          <div className="dashboard-trend-strip">
            <div>
              <span>{trendStrip.todayLabel}</span>
              <b>{money(trendStrip.todayRevenue)}</b>
            </div>
            <div>
              <span>{trendStrip.todayOrdersLabel}</span>
              <b>{trendStrip.todayOrders}</b>
            </div>
            <div>
              <span>Peak Revenue</span>
              <b>
                {money(trendStrip.peakRevenue)} <em>{trendStrip.peakRevenueLabel}</em>
              </b>
            </div>
            <div>
              <span>Peak Orders</span>
              <b>
                {trendStrip.peakOrders} <em>{trendStrip.peakOrdersLabel}</em>
              </b>
            </div>
          </div>
        </div>

        <div className="dashboard-chart-box dashboard-category-card">
          <h2>Orders by Category</h2>
          {categoryBreakdown.rows.length === 0 ? (
            <p>No category data</p>
          ) : (
            <>
              <div className="dashboard-category-donut">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown.rows}
                      dataKey="orders"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={2}
                    >
                      {categoryBreakdown.rows.map((row) => (
                        <Cell key={row.name} fill={row.color} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dashboard-category-donut-center">
                  <b>{categoryBreakdown.totalOrders}</b>
                  <span>Total Items</span>
                </div>
              </div>

              <div className="dashboard-category-legend">
                {categoryBreakdown.rows.slice(0, 5).map((row) => (
                  <span key={row.name}>
                    <i style={{ backgroundColor: row.color }} />
                    {row.name}
                    <b>{row.share.toFixed(0)}%</b>
                  </span>
                ))}
              </div>

              <div className="dashboard-category-top">
                <Crown size={15} />
                <p>
                  <b>{categoryBreakdown.rows[0]?.name}</b> is the most ordered category this range.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="dashboard-main-grid">
        <div className="dashboard-chart-box dashboard-topdishes-card">
          <div className="dashboard-trend-head">
            <h2>Top Selling Dishes</h2>
          </div>
          {topItems.length === 0 ? (
            <p>No item sale yet</p>
          ) : (
            <div className="dashboard-dish-list">
              {topItems.slice(0, 5).map((item, index) => (
                <div className="dashboard-dish-row" key={item.name}>
                  <span
                    className="dashboard-dish-avatar"
                    style={{ backgroundColor: `${chartColors[index % chartColors.length]}1a`, color: chartColors[index % chartColors.length] }}
                  >
                    {item.name?.slice(0, 1) || "D"}
                  </span>
                  <div className="dashboard-dish-info">
                    <b>{item.name}</b>
                    <span>{item.qty} Orders</span>
                  </div>
                  <strong>{money(item.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-chart-box dashboard-status-card">
          <h2>Order Status</h2>
          <div className="dashboard-status-gauge">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={orderStatusBreakdown}
                  dataKey="value"
                  nameKey="name"
                  startAngle={200}
                  endAngle={-20}
                  innerRadius={68}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {orderStatusBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="dashboard-status-gauge-center">
              <b>{filteredOrders.length}</b>
              <span>Orders</span>
            </div>
          </div>

          <div className="dashboard-status-chips">
            {orderStatusBreakdown.map((entry) => (
              <div className="dashboard-status-chip" key={entry.name}>
                <b style={{ color: entry.color }}>{entry.percent}%</b>
                <span>{entry.name}</span>
                <small>{entry.value}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-insights-card">
        <h2>Business Insights</h2>
        <div className="dashboard-insights-grid">
          <div>
            <span>Revenue Trend</span>
            <b className={saleTrend >= 0 ? "up" : "down"}>
              {saleTrend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(saleTrend).toFixed(1)}% vs Yesterday
            </b>
          </div>
          <div>
            <span>Top Item</span>
            <b><Award size={14} /> {businessInsights.topItem}</b>
          </div>
          <div>
            <span>Best Seller</span>
            <b><Crown size={14} /> {businessInsights.bestSeller}</b>
          </div>
          <div>
            <span>Peak Hour</span>
            <b><Clock size={14} /> {businessInsights.peakHour}</b>
          </div>
        </div>
      </div>

      <div className="dashboard-charts-grid restaurant-chart-grid">
        <ChartBox title="Peak Hours">
          <BarPanel data={peakHours} dataKey="orders" color="#e11d48" empty="No peak hour data" />
        </ChartBox>

        <ChartBox title="Peak Days">
          <BarPanel data={peakDays} dataKey="sale" color="#0d9488" moneyTooltip empty="No peak day data" />
        </ChartBox>

        <ChartBox title="Top Best Item Sale">
          <BarPanel data={topItems} dataKey="amount" color="#2563eb" moneyTooltip empty="No item sale yet" />
        </ChartBox>

        <ChartBox title="Payment Section">
          {paymentData.length === 0 ? (
            <p>No payment data</p>
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <PieChart>
                <Pie data={paymentData} dataKey="amount" nameKey="name" outerRadius={92} innerRadius={48} paddingAngle={2}>
                  {paymentData.map((_, index) => (
                    <Cell key={index} fill={chartColors[index % chartColors.length]} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => money(value)} contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartBox>
      </div>

      <div className="dashboard-breakdown-grid restaurant-dashboard-summary">
        <Breakdown
          title="Top Day For Sale"
          rows={[
            ["Day", topDay?.name || "-"],
            ["Sale", money(topDay?.sale || 0)],
            ["Orders", topDay?.orders || 0],
          ]}
        />
        <Breakdown
          title="Total Sale"
          rows={[
            ["Selected Sale", money(stats.totalSale)],
            ["Average Bill", money(stats.averageBill)],
            ["Paid Orders", paidOrders.length],
          ]}
        />
        <Breakdown
          title="Payment Section"
          rows={paymentData.length ? paymentData.map((entry) => [entry.name, money(entry.amount)]) : [["No payment", "Rs 0"]]}
        />
      </div>

      <div className="dashboard-chart-box restaurant-wide-chart">
        <h2>Total Sale & Total Order - Last 20 Days</h2>
        <ResponsiveContainer width="100%" height={330}>
          <BarChart data={last20Days} barGap={4} margin={{ bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ ...axisTick, fontSize: 10.5 }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              angle={-35}
              textAnchor="end"
              height={56}
              interval="preserveStartEnd"
            />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value, name) => (name === "sale" ? money(value) : value)}
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              cursor={tooltipCursor}
            />
            <Bar dataKey="sale" fill="#e11d48" radius={[6, 6, 0, 0]} maxBarSize={22} />
            <Bar dataKey="orders" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="dashboard-charts-grid restaurant-chart-grid">
        <ChartBox title="Hourly Sales (This Month)">
          <BarPanel
            data={analytics.hourlyBreakdown.map((h) => ({ name: `${h.hour}:00`, amount: h.amount }))}
            dataKey="amount"
            color="#e11d48"
            moneyTooltip
            empty="No hourly data"
          />
        </ChartBox>

        <ChartBox title="Table Performance (This Month)">
          <BarPanel
            data={analytics.tablePerformance.map((t) => ({ name: `Table ${t.tableNo}`, revenue: t.revenue }))}
            dataKey="revenue"
            color="#0d9488"
            moneyTooltip
            empty="No table data"
          />
        </ChartBox>

        <ChartBox title="Top Selling Items">
          <BarPanel
            data={analytics.topSelling.map((i) => ({ name: i.name, qty: i.qty }))}
            dataKey="qty"
            color="#2563eb"
            empty="No item data"
          />
        </ChartBox>

        <ChartBox title="Least Selling Items">
          <BarPanel
            data={analytics.leastSelling.map((i) => ({ name: i.name, qty: i.qty }))}
            dataKey="qty"
            color="#f59e0b"
            empty="No item data"
          />
        </ChartBox>
      </div>

      <div className="important-notices dashboard-delete-notices">
        <h2>Low Stock Raw Materials</h2>
        {analytics.lowStockRawMaterials.length === 0 ? (
          <p>No raw material below threshold.</p>
        ) : (
          <div className="delete-notice-list">
            {analytics.lowStockRawMaterials.map((m) => (
              <div key={m._id}>
                <span>{m.unit}</span>
                <b>{m.name}</b>
                <p>Stock: {m.stock} (threshold {m.lowStockThreshold})</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="important-notices dashboard-delete-notices">
        <h2>Delete Notifications</h2>
        {deletionLogs.length === 0 ? (
          <p>No delete activity yet.</p>
        ) : (
          <div className="delete-notice-list">
            {deletionLogs.map((log) => (
              <div key={log._id}>
                <span>{new Date(log.createdAt).toLocaleString("en-IN")}</span>
                <b>{log.recordType}: {log.recordNo}</b>
                <p>{log.title} deleted by {log.deletedBy}. {log.details}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ title, value, quiet = false, icon: Icon, tone = "slate", trend, trendLabel, sparkline, sparklineColor }) {
  const hasTrend = typeof trend === "number" && Number.isFinite(trend);
  const trendUp = trend >= 0;
  const hasSparkline = Array.isArray(sparkline) && sparkline.some((v) => v > 0);

  return (
    <div className={`dashboard-stat-card ${Icon ? "kpi-iconed" : quiet ? "" : "kpi-primary"}`}>
      <div className="kpi-top-row">
        {Icon && (
          <span className={`kpi-icon-chip tone-${tone}`}>
            <Icon size={20} />
          </span>
        )}
        <div className="kpi-body">
          <span>{title}</span>
          <h2>{value}</h2>
          {hasTrend && (
            <small className={trendUp ? "kpi-trend up" : "kpi-trend down"}>
              {trendUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {Math.abs(trend).toFixed(1)}% {trendLabel}
            </small>
          )}
        </div>
      </div>
      {hasSparkline && (
        <div className="kpi-sparkline">
          <MiniSparkline data={sparkline} color={sparklineColor} />
        </div>
      )}
    </div>
  );
}

function MiniSparkline({ data, color }) {
  const chartData = data.map((value, index) => ({ index, value }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="value" stroke={color || "#f97316"} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartBox({ title, children }) {
  return (
    <div className="dashboard-chart-box">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function BarPanel({ data, dataKey, color, moneyTooltip = false, empty }) {
  if (!data.length) return <p>{empty}</p>;

  const rotate = data.length > 4;

  return (
    <ResponsiveContainer width="100%" height={290}>
      <BarChart data={data} margin={{ bottom: rotate ? 28 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ ...axisTick, fontSize: 10.5 }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
          angle={rotate ? -35 : 0}
          textAnchor={rotate ? "end" : "middle"}
          height={rotate ? 60 : 30}
          interval="preserveStartEnd"
        />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => (moneyTooltip ? money(value) : value)}
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          cursor={tooltipCursor}
        />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Breakdown({ title, rows }) {
  return (
    <div className="dashboard-breakdown-card">
      <h2>{title}</h2>
      {rows.map(([label, value]) => (
        <p key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </p>
      ))}
    </div>
  );
}
