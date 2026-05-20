import { useRef, useEffect } from "react";

export default function OTPInput({ length = 8, value = [], onChange, disabled, error }) {
  const refs = useRef([]);

  useEffect(() => {
    if (!disabled) refs.current[0]?.focus();
  }, [disabled]);

  const handleChange = (e, idx) => {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[idx] = digit;
    onChange(next);
    if (digit && idx < length - 1) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
      const next = [...value];
      next[idx - 1] = "";
      onChange(next);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!text) return;
    const next = [...value];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    onChange(next);
    const focusIdx = Math.min(text.length, length - 1);
    refs.current[focusIdx]?.focus();
  };

  return (
    <div className="otp-container">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={i === 0 ? handlePaste : undefined}
          disabled={disabled}
          className={`otp-box ${error ? "otp-box--error" : ""} ${value[i] ? "otp-box--filled" : ""}`}
        />
      ))}
    </div>
  );
}
