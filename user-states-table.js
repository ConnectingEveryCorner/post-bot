import { get, run } from "./database.js";

export const UserStates = {
  async init() {
    await run(
      `CREATE TABLE IF NOT EXISTS user_states (
        user_id TEXT PRIMARY KEY,
        step TEXT NOT NULL,
        data_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
  },

  async set(userId, step, data = {}) {
    await run(
      `INSERT INTO user_states (user_id, step, data_json, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         step = excluded.step,
         data_json = excluded.data_json,
         updated_at = CURRENT_TIMESTAMP`,
      [String(userId), step, JSON.stringify(data)],
    );
  },

  async get(userId) {
    if (!userId) {
      return undefined;
    }

    const state = await get("SELECT * FROM user_states WHERE user_id = ?", [
      String(userId),
    ]);

    if (!state) {
      return undefined;
    }

    return {
      ...state,
      data: JSON.parse(state.data_json || "{}"),
    };
  },

  async clear(userId) {
    await run("DELETE FROM user_states WHERE user_id = ?", [String(userId)]);
  },
};
