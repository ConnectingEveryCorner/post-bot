import got from "got";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const MESSAGE_DEFAULTS = {
  parse_mode: "HTML",
  disable_web_page_preview: true,
};

export async function request(botToken, method, params = {}) {
  if (!botToken) {
    throw new Error("botToken is required");
  }

  const url = `${TELEGRAM_API_BASE}${botToken}/${method}`;
  const result = await got.post(url, {
    json: params,
    responseType: "json",
    throwHttpErrors: false,
  });

  const body = result.body;
  if (!body?.ok) {
    const description = body?.description ?? `HTTP ${result.statusCode}`;
    throw new Error(`Telegram API ${method} failed: ${description}`);
  }

  return body.result;
}

export function sendMessage(botToken, params) {
  return request(botToken, "sendMessage", {
    ...MESSAGE_DEFAULTS,
    ...params,
  });
}

export function editMessageText(botToken, params) {
  return request(botToken, "editMessageText", {
    ...MESSAGE_DEFAULTS,
    ...params,
  });
}

export function deleteMessage(botToken, params) {
  return request(botToken, "deleteMessage", params);
}

export function answerCallbackQuery(botToken, params) {
  return request(botToken, "answerCallbackQuery", params);
}

export function answerInlineQuery(botToken, params) {
  return request(botToken, "answerInlineQuery", params);
}

export function getMe(botToken) {
  return request(botToken, "getMe");
}

export function setMyCommands(botToken, params) {
  return request(botToken, "setMyCommands", params);
}

export default {
  request,
  sendMessage,
  editMessageText,
  deleteMessage,
  answerCallbackQuery,
  answerInlineQuery,
  getMe,
  setMyCommands,
};
