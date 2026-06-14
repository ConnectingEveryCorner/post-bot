import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sqlite3 from "sqlite3";

const DATABASE_PATH = resolve("./data/post-bot.sqlite");

let db;
let isClosed = false;

function openSqlite(databasePath) {
  return new Promise((resolveOpen, reject) => {
    const connection = new sqlite3.Database(databasePath, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolveOpen(connection);
    });
  });
}

function ensureDatabase() {
  if (!db || isClosed) {
    throw new Error("Database is not initialized");
  }

  return db;
}

export async function initDatabase() {
  if (db && !isClosed) {
    return db;
  }

  await mkdir(dirname(DATABASE_PATH), { recursive: true });
  db = await openSqlite(DATABASE_PATH);
  isClosed = false;

  await run("PRAGMA journal_mode = WAL");
  await run("PRAGMA foreign_keys = ON");

  return db;
}

export function run(sql, params = []) {
  const connection = ensureDatabase();

  return new Promise((resolveRun, reject) => {
    connection.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolveRun(this);
    });
  });
}

export function get(sql, params = []) {
  const connection = ensureDatabase();

  return new Promise((resolveGet, reject) => {
    connection.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolveGet(row);
    });
  });
}

export function all(sql, params = []) {
  const connection = ensureDatabase();

  return new Promise((resolveAll, reject) => {
    connection.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolveAll(rows);
    });
  });
}

export async function closeDatabase() {
  if (!db || isClosed) {
    return;
  }

  const connection = db;
  isClosed = true;
  db = undefined;

  await new Promise((resolveClose, reject) => {
    connection.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolveClose();
    });
  });
}

export function getDatabasePath() {
  return DATABASE_PATH;
}
