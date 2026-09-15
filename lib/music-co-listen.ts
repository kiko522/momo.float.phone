// lib/music-co-listen.ts
// 「一起听」共听时长统计：播放器在播放即视为 user 与角色一起听（本机模拟）。
// 按天累计 + 历史累计，持久化到 localStorage；切歌/暂停由调用方（music-context）控制。

import { kvGet, kvSet, registerKvMigration } from "./kv-db";

const CO_LISTEN_KEY = "ai_phone_music_colisten_v1";
registerKvMigration(CO_LISTEN_KEY);

const EVENT_NAME = "music-co-listen-updated";

type CoListenData = {
    todayKey: string; // YYYY-MM-DD
    todaySeconds: number;
    totalSeconds: number;
};

function todayKey(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
}

function loadData(): CoListenData {
    const fallback: CoListenData = { todayKey: todayKey(), todaySeconds: 0, totalSeconds: 0 };
    try {
        const raw = typeof window !== "undefined" ? kvGet(CO_LISTEN_KEY) : null;
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as Partial<CoListenData>;
        const key = todayKey();
        return {
            todayKey: key,
            todaySeconds: parsed.todayKey === key ? (Number(parsed.todaySeconds) || 0) : 0,
            totalSeconds: Number(parsed.totalSeconds) || 0,
        };
    } catch {
        return fallback;
    }
}

function persist(data: CoListenData): void {
    try { kvSet(CO_LISTEN_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

let lastEmit = 0;
function emitUpdated(): void {
    const now = Date.now();
    // 节流：播放器每秒累加，事件每 5 秒最多发一次，避免 UI 频繁重渲染。
    if (now - lastEmit < 5000) return;
    lastEmit = now;
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(EVENT_NAME));
    }
}

/** 累加共听秒数（播放器播放中每秒调用一次）。 */
export function addCoListenSeconds(seconds: number): void {
    const data = loadData();
    data.todaySeconds += Math.max(0, seconds);
    data.totalSeconds += Math.max(0, seconds);
    persist(data);
    emitUpdated();
}

export type CoListenStats = {
    todaySeconds: number;
    totalSeconds: number;
};

export function getCoListenStats(): CoListenStats {
    const data = loadData();
    return { todaySeconds: data.todaySeconds, totalSeconds: data.totalSeconds };
}

/** 将秒数格式化为可读时长（用于展示「一起听 xx」）。 */
export function formatCoListenDuration(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h} 小时 ${m} 分`;
    if (m > 0) return `${m} 分 ${sec} 秒`;
    return `${sec} 秒`;
}

/** UI 订阅用：播放器播放中触发，供「一起听」面板刷新。 */
export const MUSIC_CO_LISTEN_EVENT = EVENT_NAME;
