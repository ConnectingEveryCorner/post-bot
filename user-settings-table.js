import { get, run } from "./database.js";

export const UserSettings = {
  async init() {
    await run(
      `CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        locale TEXT,
        start_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
  },

  async save(userId, values = {}) {
    const hasStartCount = values.startCount !== undefined;

    await run(
      `INSERT INTO user_settings (user_id, locale, start_count, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         locale = COALESCE(excluded.locale, user_settings.locale),
         start_count = CASE
           WHEN ? = 1 THEN excluded.start_count
           ELSE user_settings.start_count
         END,
         updated_at = CURRENT_TIMESTAMP`,
      [
        String(userId),
        values.locale ?? null,
        hasStartCount ? values.startCount : 0,
        hasStartCount ? 1 : 0,
      ],
    );
  },

  async incrementStartCount(userId) {
    const settings = await this.get(userId);
    const startCount = (settings?.start_count ?? 0) + 1;
    await this.save(userId, { startCount });
    return startCount;
  },

  async get(userId) {
    if (!userId) {
      return undefined;
    }

    return get("SELECT * FROM user_settings WHERE user_id = ?", [
      String(userId),
    ]);
  },

  async getLocale(userId) {
    const settings = await this.get(userId);
    return settings?.locale;
  },
};
