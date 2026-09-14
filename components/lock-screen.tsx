"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { loadLockScreenConfig, isValidPin } from "@/lib/lock-screen-storage";

type LockScreenProps = {
  onUnlock: () => void;
};

function formatClock(date: Date): string {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [now, setNow] = useState(() => new Date());
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // 锁屏出现即抢焦点；移动端自动弹出数字键盘。
    const focus = () => inputRef.current?.focus();
    focus();
    // 部分浏览器在渲染后焦点会被抢走，补一次。
    const timer = window.setTimeout(focus, 80);
    return () => window.clearTimeout(timer);
  }, []);

  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
    setError(false);
    if (digits.length === 4) {
      const config = loadLockScreenConfig();
      if (isValidPin(config.pin) && digits === config.pin) {
        onUnlock();
      } else {
        setError(true);
        setPin("");
      }
    }
  };

  return (
    <div
      className="lock-screen-overlay"
      data-ui="lock-screen"
      role="dialog"
      aria-label="锁屏"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="lock-screen-clock">{formatClock(now)}</div>
      <div className="lock-screen-date">{formatDate(now)}</div>

      <div className="lock-screen-pin-wrap">
        <div className="lock-screen-pin-icon">
          <Lock size={22} strokeWidth={1.75} />
        </div>
        <input
          ref={inputRef}
          className={`lock-screen-pin-input${error ? " lock-screen-pin-input-error" : ""}`}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          placeholder="输入 4 位 PIN"
          aria-label="PIN 码"
          onChange={(e) => handleChange(e.target.value)}
        />
        <div className="lock-screen-pin-dots" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`lock-screen-pin-dot${i < pin.length ? " filled" : ""}${error ? " error" : ""}`} />
          ))}
        </div>
        <div className={`lock-screen-pin-hint${error ? " lock-screen-pin-hint-error" : ""}`}>{error ? "PIN 不正确，请重试" : "请输入锁屏 PIN"}</div>
      </div>
    </div>
  );
}
