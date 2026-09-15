// lib/music-account.ts
// 角色网易云「小号」绑定管理。
// 用户主账号沿用 music-service 里的全局 cookie（ai_phone_netease_cookie_v1）；
// 这里为每个角色额外保存一个独立的登录态，供角色自助建歌单 / 加歌使用。

import { kvGet, kvSet, kvRemove, registerKvMigration } from "./kv-db";

const CHARACTER_ACCOUNTS_KEY = "ai_phone_music_character_accounts_v1";
registerKvMigration(CHARACTER_ACCOUNTS_KEY);

const ACCOUNTS_UPDATED_EVENT = "music-character-accounts-updated";

export type CharacterMusicAccount = {
    characterId: string;
    cookie: string;
    nickname: string;
    updatedAt: string;
};

function loadAll(): Record<string, CharacterMusicAccount> {
    if (typeof window === "undefined") return {};
    try {
        const raw = kvGet(CHARACTER_ACCOUNTS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, CharacterMusicAccount>;
        const result: Record<string, CharacterMusicAccount> = {};
        for (const [id, acc] of Object.entries(parsed)) {
            if (acc && typeof acc.cookie === "string" && acc.cookie) {
                result[id] = acc;
            }
        }
        return result;
    } catch {
        return {};
    }
}

function persist(all: Record<string, CharacterMusicAccount>): void {
    try { kvSet(CHARACTER_ACCOUNTS_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

function emitUpdated(): void {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(ACCOUNTS_UPDATED_EVENT));
    }
}

/** 读取某个角色绑定的音乐小号。 */
export function loadCharacterMusicAccount(characterId: string): CharacterMusicAccount | null {
    return loadAll()[characterId] ?? null;
}

/** 保存 / 更新某个角色的音乐小号。 */
export function saveCharacterMusicAccount(characterId: string, cookie: string, nickname: string): void {
    if (!characterId || !cookie) return;
    const all = loadAll();
    all[characterId] = {
        characterId,
        cookie,
        nickname: nickname || "已绑定",
        updatedAt: new Date().toISOString(),
    };
    persist(all);
    emitUpdated();
}

/** 解绑某个角色的音乐小号。 */
export function clearCharacterMusicAccount(characterId: string): void {
    const all = loadAll();
    if (!all[characterId]) return;
    delete all[characterId];
    persist(all);
    emitUpdated();
}

/** 列出全部已绑定的角色小号（返回数组，便于 UI 遍历）。 */
export function loadAllCharacterMusicAccounts(): CharacterMusicAccount[] {
    return Object.values(loadAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 角色音乐账号变更事件名（UI 订阅刷新用）。 */
export const MUSIC_CHARACTER_ACCOUNTS_EVENT = ACCOUNTS_UPDATED_EVENT;
