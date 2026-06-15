import crypto from "node:crypto";
import { all, get, run } from "./database.js";

function createIdentifier() {
  return crypto.randomBytes(4).toString("hex");
}

async function createUniqueIdentifier() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const identifier =
      attempt < 20
        ? createIdentifier()
        : `${Date.now().toString(36)}${createIdentifier()}`;
    const existing = await get("SELECT id FROM resources WHERE identifier = ?", [
      identifier,
    ]);

    if (!existing) {
      return identifier;
    }
  }

  throw new Error("Could not create a unique resource identifier");
}

export const Resources = {
  async init() {
    await run(
      `CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_user_id TEXT NOT NULL,
        identifier TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        send_text TEXT NOT NULL,
        message_json TEXT NOT NULL,
        query_count INTEGER NOT NULL DEFAULT 0,
        send_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await run(
      `CREATE TABLE IF NOT EXISTS resource_buttons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        url TEXT NOT NULL,
        row_index INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE
      )`,
    );
  },

  async countByUser(userId) {
    const row = await get(
      "SELECT COUNT(*) AS total FROM resources WHERE owner_user_id = ?",
      [String(userId)],
    );
    return row?.total ?? 0;
  },

  async create(userId, resource) {
    const identifier = await createUniqueIdentifier();
    const result = await run(
      `INSERT INTO resources (owner_user_id, identifier, type, title, send_text, message_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(userId),
        identifier,
        resource.type,
        resource.title,
        resource.sendText,
        JSON.stringify(resource.message),
      ],
    );

    return this.getById(result.lastID);
  },

  async getById(id) {
    const resource = await get("SELECT * FROM resources WHERE id = ?", [id]);
    return hydrateResource(resource);
  },

  async getByIdentifier(identifier) {
    const resource = await get("SELECT * FROM resources WHERE identifier = ?", [
      identifier,
    ]);
    return hydrateResource(resource);
  },

  async listByUser(userId, page, pageSize) {
    const total = await this.countByUser(userId);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const rows = await all(
      `SELECT * FROM resources
       WHERE owner_user_id = ?
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [String(userId), pageSize, (safePage - 1) * pageSize],
    );

    return {
      items: await Promise.all(rows.map(hydrateResource)),
      page: safePage,
      pageSize,
      total,
      totalPages,
    };
  },

  async deleteByIdForUser(id, userId) {
    await run("DELETE FROM resources WHERE id = ? AND owner_user_id = ?", [
      id,
      String(userId),
    ]);
  },

  async replaceButtons(resourceId, buttonRows) {
    await run("DELETE FROM resource_buttons WHERE resource_id = ?", [resourceId]);

    for (const [rowIndex, buttons] of buttonRows.entries()) {
      for (const [position, button] of buttons.entries()) {
        await run(
          `INSERT INTO resource_buttons (resource_id, text, url, row_index, position)
           VALUES (?, ?, ?, ?, ?)`,
          [resourceId, button.text, button.url, rowIndex, position],
        );
      }
    }

    await run(
      "UPDATE resources SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resourceId],
    );
  },

  async updateSendText(id, userId, sendText) {
    const resource = await this.getById(id);

    if (!resource || resource.owner_user_id !== String(userId)) {
      return undefined;
    }

    const message = {
      ...resource.message,
      text: sendText,
      entities: [],
    };

    await run(
      `UPDATE resources
       SET send_text = ?,
           message_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_user_id = ?`,
      [sendText, JSON.stringify(message), id, String(userId)],
    );

    return this.getById(id);
  },

  async incrementQueryCount(id) {
    await run(
      `UPDATE resources
       SET query_count = query_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id],
    );
  },

  async incrementSendCount(id) {
    await run(
      `UPDATE resources
       SET send_count = send_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id],
    );
  },

  async getButtons(resourceId) {
    return all(
      "SELECT * FROM resource_buttons WHERE resource_id = ? ORDER BY row_index ASC, position ASC, id ASC",
      [resourceId],
    );
  },
};

async function hydrateResource(resource) {
  if (!resource) {
    return undefined;
  }

  const message = JSON.parse(resource.message_json);
  message.text = resource.send_text;

  return {
    ...resource,
    message,
    buttons: await Resources.getButtons(resource.id),
  };
}
