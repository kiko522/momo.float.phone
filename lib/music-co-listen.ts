// lib/music-co-listen.ts
// 「一起听」共听时长统计（按角色分账）。
// 播放器在播即视为 user 与「当前共听角色」一起听（本机模拟）。
// 当前共听角色：手动指定 > 最近聊天的私聊角色；都不存在则只计总时长、不计入角色。

import { kvGet, kvSet, registerKvMigration } from "./kv-db";
import { loadChatSessions } from "./chat-storage";
import { loadCharacters } from "./character-storage";

const CO_LISTEN_KEY = "ai_phone_music_colisten_v2";
registerKvMigration(CO_LISTEN_KEY);

export const MUSIC_CO_LISTEN_EVENT = "music-co-listen-updated";
export const MUSIC_CO_LISTEN_TARGET_EVENT = "music-co-listen-target-changed";

type CoListenEntry = {
    totalSeconds: number;
    todaySeconds: number;
    todayKey: string;
};

type CoListenData = {
    totalSeconds: number;
    todaySeconds: number;
    todayKey: string;
    entries: Record<string, CoListenEntry>;
    /** null = 跟随「最近聊天的私聊角色」 */
    targetId: string | null;
};

function todayKey(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
}

function normalize(raw: unknown): CoListenData {
    const key = todayKey();
    const base: CoListenData = {
        totalSeconds: 0,
        todaySeconds: 0,
        todayKey: key,
        entries: {},
        targetId: null,
    };
    if (!raw || typeof raw !== "object") return base;
    const src = raw as Partial<CoListenData>;
    base.totalSeconds = Math.max(0, Number(src.totalSeconds) || 0);
    base.targetId = typeof src.targetId === "string" && src.targetId ? src.targetId : null;
    if (src.todayKey === key) base.todaySeconds = Math.max(0, Number(src.todaySeconds) || 0);
    if (src.entries && typeof src.entries === "object") {
        for (const [id, entry] of Object.entries(src.entries as Record<string, unknown>)) {
            if (!id || !entry || typeof entry !== "object") continue;
            const e = entry as Partial<CoListenEntry>;
            base.entries[id] = {
                totalSeconds: Math.max(0, Number(e.totalSeconds) || 0),
                todaySeconds: e.todayKey === key ? Math.max(0, Number(e.todaySeconds) || 0) : 0,
                todayKey: key,
            };
        }
    }
    return base;
}

function loadData(): CoListenData {
    try {
        const raw = typeof window !== "undefined" ? kvGet(CO_LISTEN_KEY) : null;
        return raw ? normalize(JSON.parse(raw)) : normalize(null);
    } catch {
        return normalize(null);
    }
}

function persist(data: CoListenData): void {
    try { kvSet(CO_LISTEN_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

/** 最近聊天的私聊角色（非群聊、contactId 有效，按 updatedAt 最新）。 */
function resolveRecentCharacterId(): string | null {
    try {
        const sessions = loadChatSessions();
        const direct = sessions.filter((session) => !session.isGroup && !!session.contactId);
        direct.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
        return direct[0]?.contactId ?? null;
    } catch {
        return null;
    }
}

/** 解析当前实际应计入的共听角色：手动指定优先，其次最近聊天。 */
export function resolveCoListenTarget(): string | null {
    const data = loadData();
    return data.targetId || resolveRecentCharacterId();
}

/** 返回存储的 target 原始值（null 表示跟随最近聊天）。 */
export function getCoListenTargetId(): string | null {
    return loadData().targetId;
}

/** 手动指定共听角色；传 null 表示「跟随最近聊天」。 */
export function setCoListenTarget(characterId: string | null): void {
    const data = loadData();
    data.targetId = characterId || null;
    persist(data);
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(MUSIC_CO_LISTEN_TARGET_EVENT));
        window.dispatchEvent(new CustomEvent(MUSIC_CO_LISTEN_EVENT));
    }
}

let lastEmit = 0;
function emitUpdatedThrottled(): void {
    const now = Date.now();
    // 节流：播放器每秒累加，事件每 5 秒最多发一次，避免 UI 频繁重渲染。
    if (now - lastEmit < 5000) return;
    lastEmit = now;
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(MUSIC_CO_LISTEN_EVENT));
    }
}

/** 累加 1 秒共听时长：计入当前共听角色 + 全局总计。 */
export function addCoListenSecond(): void {
    const data = loadData();
    const key = todayKey();
    if (data.todayKey !== key) {
        data.todayKey = key;
        data.todaySeconds = 0;
        for (const id of Object.keys(data.entries)) {
            const e = data.entries[id];
            if (e) {
                e.todaySeconds = 0;
                e.todayKey = key;
            }
        }
    }
    data.totalSeconds += 1;
    data.todaySeconds += 1;

    const target = data.targetId || resolveRecentCharacterId();
    if (target) {
        const entry = data.entries[target] ?? { totalSeconds: 0, todaySeconds: 0, todayKey: key };
        if (entry.todayKey !== key) {
            entry.todayKey = key;
            entry.todaySeconds = 0;
        }
        entry.totalSeconds += 1;
        entry.todaySeconds += 1;
        data.entries[target] = entry;
    }

    persist(data);
    emitUpdatedThrottled();
}

export type CoListenEntryView = {
    characterId: string;
    name: string;
    todaySeconds: number;
    totalSeconds: number;
};

export type CoListenStats = {
    todaySeconds: number;
    totalSeconds: number;
    /** 手动指定的 target（null = 跟随最近聊天） */
    targetId: string | null;
    /** 实际生效的 target（解析「跟随最近聊天」后） */
    resolvedTargetId: string | null;
    entries: CoListenEntryView[];
};

/** 读取全部共听统计（含每个角色分账，按累计时长降序）。 */
export function getCoListenStats(): CoListenStats {
    const data = loadData();
    const key = todayKey();
    const characters = loadCharacters();
    const entries = Object.entries(data.entries)
        .map(([characterId, entry]) => ({
            characterId,
            name: characters.find((item) => item.id === characterId)?.name ?? "未知角色",
            todaySeconds: entry.todayKey === key ? entry.todaySeconds : 0,
            totalSeconds: entry.totalSeconds,
        }))
        .sort((a, b) => b.totalSeconds - a.totalSeconds);
    return {
        todaySeconds: data.todayKey === key ? data.todaySeconds : 0,
        totalSeconds: data.totalSeconds,
        targetId: data.targetId,
        resolvedTargetId: data.targetId || resolveRecentCharacterId(),
        entries,
    };
}

/** 读取单个角色的共听时长。 */
export function getCoListenForCharacter(characterId: string): { todaySeconds: number; totalSeconds: number } {
    const data = loadData();
    const key = todayKey();
    const entry = data.entries[characterId];
    if (!entry) return { todaySeconds: 0, totalSeconds: 0 };
    return {
        todaySeconds: entry.todayKey === key ? entry.todaySeconds : 0,
        totalSeconds: entry.totalSeconds,
    };
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
