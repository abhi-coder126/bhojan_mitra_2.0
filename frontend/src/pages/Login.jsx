import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Store, Utensils } from "lucide-react";
import API from "../api/axios";

export default function Login() {
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginNotice, setLoginNotice] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const updateField = (field, value) => {
    setLoginNotice(null);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const login = async (e) => {
    e.preventDefault();
    if (isLoggingIn) return;

    try {
      setIsLoggingIn(true);
      setLoginNotice(null);
      const res = await API.post("/auth/login", form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      sessionStorage.setItem("showWelcome", "1");
      navigate("/");
    } catch (error) {
      if (!error.response) {
        setLoginNotice({
          image: "/404.svg",
          title: "Server is not running",
          message: "Backend server se connection nahi ho pa raha. Server start karke dobara login karein.",
        });
      } else {
        setLoginNotice({
          image: "/failed.svg",
          title: "Login failed",
          message: "Email ya password check karke dobara try karein.",
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-showcase" aria-label="BhojanMitra">
        <div className="login-brand-lockup">
          <img src="/BhojanMitra_Logo.png" alt="BhojanMitra" />
          <span>Restaurant POS Suite</span>
        </div>
        <div className="login-showcase-copy">
          <h1>Billing, orders and inventory in one calm workspace.</h1>
          <p>Built for quick counters, live restaurant orders, purchase tracking and daily reports.</p>
        </div>
        <div className="login-feature-grid">
          <div>
            <Store size={20} />
            <span>Live POS</span>
          </div>
          <div>
            <Utensils size={20} />
            <span>Table Orders</span>
          </div>
          <div>
            <ShieldCheck size={20} />
            <span>Secure Access</span>
          </div>
        </div>
      </section>

      <form className="login-card" onSubmit={login}>
        <div className="login-card-head">
          <img src="/BhojanMitra_Logo.png" alt="BhojanMitra" />
          <span>Welcome back</span>
          <h2>Sign in to BhojanMitra</h2>
          <p>Use your admin account to continue.</p>
        </div>

        <label className="login-field">
          <span>Email address</span>
          <div>
            <Mail size={18} />
            <input
              type="email"
              placeholder="admin@restaurant.com"
              autoComplete="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              disabled={isLoggingIn}
              required
            />
          </div>
        </label>

        <label className="login-field login-password-field">
          <span>Password</span>
          <div>
            <LockKeyhole size={18} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              disabled={isLoggingIn}
              required
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={isLoggingIn}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        {loginNotice && (
          <div className="login-error-card" role="alert">
            <img src={loginNotice.image} alt="" />
            <div>
              <strong>{loginNotice.title}</strong>
              <p>{loginNotice.message}</p>
            </div>
          </div>
        )}

        <button className="login-submit" disabled={isLoggingIn}>
          {isLoggingIn ? (
            <>
              <span className="login-spinner" />
              Signing in...
            </>
          ) : (
            "Login"
          )}
        </button>

        <p className="login-secure-note">
          <ShieldCheck size={16} />
          Protected access for billing and reports
        </p>
      </form>
    </div>
  );
}
