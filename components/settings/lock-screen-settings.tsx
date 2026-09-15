"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Check, X, Image as ImageIcon, Upload, Trash2 } from "lucide-react";
import { loadLockScreenConfig, saveLockScreenConfig, isValidPin } from "@/lib/lock-screen-storage";
import { saveThemeAssetFromBlob, deleteThemeAsset, getThemeAssetMap, describeAssetSaveError } from "@/lib/theme-storage";
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
  const [backgroundId, setBackgroundId] = useState<string | null>(initial.backgroundAssetId);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const backgroundFileRef = useRef<HTMLInputElement | null>(null);

  const hasSavedPin = isValidPin(savedPin);

  useEffect(() => {
    let cancelled = false;
    if (!backgroundId) {
      setBackgroundUrl(null);
      return;
    }
    getThemeAssetMap([backgroundId])
      .then((map) => {
        if (!cancelled) setBackgroundUrl(map[backgroundId] ?? null);
      })
      .catch(() => {
        if (!cancelled) setBackgroundUrl(null);
      });
    return () => { cancelled = true; };
  }, [backgroundId]);

  const commitPin = () => {
    if (!isValidPin(pinInput)) {
      setError("PIN 需为 4 位数字。");
      return;
    }
    if (pinInput !== pinConfirm) {
      setError("两次输入的 PIN 不一致。");
      return;
    }
    saveLockScreenConfig({ enabled: true, pin: pinInput, backgroundAssetId: backgroundId });
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
        saveLockScreenConfig({ enabled: true, pin: savedPin, backgroundAssetId: backgroundId });
        setEnabled(true);
        setError("");
        onNotice("已开启锁屏");
      } else {
        // 尚无 PIN，展开表单，设置成功后才真正开启。
        setEditing(true);
        setError("");
      }
    } else {
      saveLockScreenConfig({ enabled: false, pin: savedPin, backgroundAssetId: backgroundId });
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

  const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBackgroundBusy(true);
    try {
      const assetId = await saveThemeAssetFromBlob(file, "wallpaper");
      if (backgroundId) {
        try { await deleteThemeAsset(backgroundId); } catch { /* 忽略清理失败 */ }
      }
      const config = loadLockScreenConfig();
      saveLockScreenConfig({ ...config, backgroundAssetId: assetId });
      setBackgroundId(assetId);
      const map = await getThemeAssetMap([assetId]);
      setBackgroundUrl(map[assetId] ?? null);
      onNotice("锁屏背景已更新");
    } catch (err) {
      onNotice(describeAssetSaveError(err));
    } finally {
      setBackgroundBusy(false);
    }
  };

  const handleClearBackground = async () => {
    setBackgroundBusy(true);
    try {
      if (backgroundId) {
        try { await deleteThemeAsset(backgroundId); } catch { /* 忽略清理失败 */ }
      }
      const config = loadLockScreenConfig();
      saveLockScreenConfig({ ...config, backgroundAssetId: null });
      setBackgroundId(null);
      setBackgroundUrl(null);
      onNotice("已恢复默认锁屏背景");
    } finally {
      setBackgroundBusy(false);
    }
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

      {/* 锁屏背景 */}
      <div className="ui-group-card flex flex-col gap-3">
        <div className="flex items-center gap-[6px]">
          <ImageIcon size={16} strokeWidth={1.75} />
          <span className="menu-label">锁屏背景</span>
        </div>

        {backgroundUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-[var(--c-card-border)]">
            <img src={backgroundUrl} alt="锁屏背景预览" className="block h-36 w-full object-cover" />
            <button
              type="button"
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 ts-11 font-medium text-white backdrop-blur transition active:scale-95"
              onClick={handleClearBackground}
              disabled={backgroundBusy}
            >
              <Trash2 size={13} /> 恢复默认
            </button>
          </div>
        ) : (
          <p className="menu-desc !mt-0 !whitespace-normal">未设置背景，锁屏使用默认深色渐变。</p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ui-btn ui-btn-outline flex items-center gap-1"
            onClick={() => backgroundFileRef.current?.click()}
            disabled={backgroundBusy}
          >
            <Upload size={15} /> {backgroundUrl ? "更换图片" : "上传图片"}
          </button>
        </div>
        <input
          ref={backgroundFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadBackground}
        />
        <p className="menu-desc !mt-0 !whitespace-normal">
          上传的图片会作为锁屏背景显示在时钟与 PIN 输入区后面，与桌面壁纸相互独立。
        </p>
      </div>

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
