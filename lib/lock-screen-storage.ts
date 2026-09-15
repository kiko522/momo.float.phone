// lib/lock-screen-storage.ts
// 锁屏配置存储：4 位数字 PIN + 启用开关。
// 纯前端软锁（PIN 存本机 IndexedDB），只防随手翻看，不提供加密安全保证。

import { kvGet, kvSet, registerKvMigration } from "./kv-db";

const LOCK_SCREEN_KEY = "ai_phone_lock_screen_v1";
registerKvMigration(LOCK_SCREEN_KEY);

// 会话级解锁标记：关闭标签页/浏览器后 sessionStorage 清空，下次进入重新锁定。
const UNLOCKED_FLAG = "ai_phone_lock_unlocked";

export type LockScreenConfig = {
  enabled: boolean;
  pin: string | null;
  /** 锁屏背景图资产 ID（存于主题资源库）；null = 使用默认深色渐变背景。 */
  backgroundAssetId: string | null;
};

const DEFAULT_CONFIG: LockScreenConfig = { enabled: false, pin: null, backgroundAssetId: null };

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

function normalize(raw: unknown): LockScreenConfig {
  if (raw && typeof raw === "object") {
    const obj = raw as Partial<LockScreenConfig>;
    const pin = isValidPin(obj.pin) ? obj.pin : null;
    return {
      // 没有有效 PIN 时不允许开启，避免锁死后无法解锁。
      enabled: obj.enabled === true && pin !== null,
      pin,
      backgroundAssetId: typeof obj.backgroundAssetId === "string" ? obj.backgroundAssetId : null,
    };
  }
  return { ...DEFAULT_CONFIG };
}

export function loadLockScreenConfig(): LockScreenConfig {
  if (typeof window === "undefined") return { ...DEFAULT_CONFIG };
  try {
    const raw = kvGet(LOCK_SCREEN_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return normalize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveLockScreenConfig(config: LockScreenConfig): void {
  if (typeof window === "undefined") return;
  const normalized = normalize(config);
  kvSet(LOCK_SCREEN_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("lock-screen-config-changed"));
}

export function isSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(UNLOCKED_FLAG) === "1";
  } catch {
    return false;
  }
}

export function markSessionUnlocked(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(UNLOCKED_FLAG, "1");
  } catch {
    // 忽略：sessionStorage 不可用时保持锁定状态，用户可再输一次 PIN。
  }
}

/** 当前是否需要展示锁屏（已启用且本会话尚未解锁）。 */
export function shouldShowLockScreen(): boolean {
  const config = loadLockScreenConfig();
  return config.enabled && !isSessionUnlocked();
}
