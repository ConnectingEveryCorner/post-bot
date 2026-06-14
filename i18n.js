import { readdir, readFile } from "node:fs/promises";
import YAML from "yaml";

const LOCALES_PATH = new URL("./locales/", import.meta.url);

function getByPath(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}

function format(template, params = {}) {
  return String(template).replaceAll(/\{(\w+)\}/g, (_, key) => {
    return params[key] ?? `{${key}}`;
  });
}

export async function createI18n(options = {}) {
  const defaultLocale = options.defaultLocale ?? "en";
  const fixedLocale = options.fixedLocale || null;
  const files = await readdir(LOCALES_PATH);
  const locales = new Map();

  for (const file of files) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) {
      continue;
    }

    const locale = file.replace(/\.ya?ml$/, "");
    const raw = await readFile(new URL(file, LOCALES_PATH), "utf8");
    locales.set(locale, YAML.parse(raw));
  }

  if (!locales.has(defaultLocale)) {
    throw new Error(`i18n defaultLocale "${defaultLocale}" is not configured`);
  }

  if (fixedLocale && !locales.has(fixedLocale)) {
    throw new Error(`i18n fixedLocale "${fixedLocale}" is not configured`);
  }

  function resolveLocale(locale) {
    if (fixedLocale) {
      return fixedLocale;
    }

    return locales.has(locale) ? locale : defaultLocale;
  }

  function t(locale, key, params) {
    const resolvedLocale = resolveLocale(locale);
    const value =
      getByPath(locales.get(resolvedLocale), key) ??
      getByPath(locales.get(defaultLocale), key);

    if (value === undefined || value === null) {
      return key;
    }

    return format(value, params);
  }

  return {
    defaultLocale,
    fixedLocale,
    isLocked: Boolean(fixedLocale),
    supportedLocales: [...locales.keys()],
    resolveLocale,
    t,
  };
}
