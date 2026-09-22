const normalizePhone = (value) =>
  String(value || "")
    .replace(/^\+91\s?/, "")
    .replace(/\D/g, "")
    .slice(0, 10);

export default function PhoneInput({ value, onChange, placeholder = "Mobile number", required = false, disabled = false }) {
  const updateValue = (event) => {
    onChange(normalizePhone(event.target.value));
  };

  return (
    <label className="phone-input-wrap">
      <span className="phone-country-chip" aria-hidden="true">
        <span className="india-flag">
          <i />
          <i />
          <i />
        </span>
        +91
      </span>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={10}
        placeholder={placeholder}
        value={normalizePhone(value)}
        onChange={updateValue}
        required={required}
        disabled={disabled}
      />
    </label>
  );
}
