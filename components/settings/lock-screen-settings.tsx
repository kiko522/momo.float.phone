"use client";

import { useState } from "react";
import { Lock, Check, X } from "lucide-react";
import { loadLockScreenConfig, saveLockScreenConfig, isValidPin } from "@/lib/lock-screen-storage";
import { Toggle, Input } from "@/components/ui/form";

type LockScreenSettingsProps = {
  onNotice: (msg: string) => void;
};

export function LockScreenSettings({ onNotice }: LockScreenSettingsProps) {
  const initial = loadLockScreenConfig();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [savedPin, setSavedPin] = useState<string | null>(initial.pin);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const hasSavedPin = isValidPin(savedPin);

  const commitPin = () => {
    if (!isValidPin(pinInput)) {
      setError("PIN 需为 4 位数字。");
      return;
    }
    if (pinInput !== pinConfirm) {
      setError("两次输入的 PIN 不一致。");
      return;
    }
    saveLockScreenConfig({ enabled: true, pin: pinInput });
    setSavedPin(pinInput);
    setEnabled(true);
    setEditing(false);
    setPinInput("");
    setPinConfirm("");
    setError("");
    onNotice("锁屏 PIN 已设置");
  };

  const handleToggle = (next: boolean) => {
    if (next) {
      if (hasSavedPin) {
        saveLockScreenConfig({ enabled: true, pin: savedPin });
        setEnabled(true);
        setError("");
        onNotice("已开启锁屏");
      } else {
        // 尚无 PIN，展开表单，设置成功后才真正开启。
        setEditing(true);
        setError("");
      }
    } else {
      saveLockScreenConfig({ enabled: false, pin: savedPin });
      setEnabled(false);
      setError("");
      onNotice("已关闭锁屏");
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setPinInput("");
    setPinConfirm("");
    setError("");
  };

  return (
    <div className="flex flex-col gap-[24px]">
      {/* 开关 */}
      <div className="ui-group-card !flex-row !items-center">
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-[6px] min-w-0">
            <span className="menu-label">锁屏</span>
            {enabled && <span className="ui-badge shrink-0" data-variant="success">已开启</span>}
          </div>
          <span className="menu-desc !mt-0 !whitespace-normal">
            退出网页后重新进入需输入 4 位 PIN 解锁。仅在本机浏览器生效，为轻量隐私锁，非加密保护。
          </span>
        </div>
        <div className="shrink-0">
          <Toggle checked={enabled || editing} onChange={handleToggle} />
        </div>
      </div>

      {/* PIN 设置 / 修改 */}
      {(enabled || editing) && (
        <div className="flex flex-col gap-3">
          {!editing && hasSavedPin ? (
            <div className="ui-group-card !flex-row !items-center">
              <span className="flex-1 menu-label">当前 PIN 已设置</span>
              <button
                type="button"
                className="ui-link-btn"
                onClick={() => setEditing(true)}
              >
                修改 PIN
              </button>
            </div>
          ) : (
            <div className="ui-group-card flex flex-col gap-3">
              <div className="flex items-center gap-[6px]">
                <Lock size={16} strokeWidth={1.75} />
                <span className="menu-label">{hasSavedPin ? "修改 PIN" : "设置 PIN"}</span>
              </div>
              <div className="flex flex-col gap-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="输入 4 位数字 PIN"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                    setError("");
                  }}
                />
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="再次输入确认"
                  value={pinConfirm}
                  onChange={(e) => {
                    setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4));
                    setError("");
                  }}
                />
                {error ? (
                  <span className="ts-12" style={{ color: "var(--c-danger)" }}>{error}</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="ui-btn ui-btn-primary flex items-center gap-1" onClick={commitPin}>
                  <Check size={15} /> 保存
                </button>
                {hasSavedPin && (
                  <button type="button" className="ui-btn ui-btn-ghost flex items-center gap-1" onClick={cancelEditing}>
                    <X size={15} /> 取消
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 说明 */}
      <div className="ui-group-card flex flex-col gap-2">
        <span className="menu-label">忘记 PIN 怎么办</span>
        <span className="menu-desc !mt-0 !whitespace-normal">
          锁屏 PIN 存在本机浏览器数据里，无法在线找回。若忘记，需清除本站点浏览器数据后重新导入备份（未备份的本地档会丢失）。建议设置 PIN 后先在「设置 → 数据管理」导出一份备份。
        </span>
      </div>
    </div>
  );
}
