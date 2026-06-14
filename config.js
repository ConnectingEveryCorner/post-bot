import { readFile } from "node:fs/promises";
import YAML from "yaml";

const CONFIG_PATH = new URL("./config.yaml", import.meta.url);

export async function loadConfig() {
  const raw = await readFile(CONFIG_PATH, "utf8");
  const config = YAML.parse(raw);

  if (!config?.bot?.token || config.bot.token === "YOUR_BOT_TOKEN") {
    throw new Error("Please configure bot.token in config.yaml first");
  }

  return config;
}

export function getConfiguredReply(config, locale, key, fallback) {
  return config.replies?.[key]?.[locale] ?? config.replies?.[key]?.en ?? fallback;
}
