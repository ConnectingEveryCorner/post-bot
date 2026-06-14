import got from "got";
import logger from "./logger.js";

export function notifyUpdate(config, update) {
  const notification = config.updateNotification;

  if (!notification?.enabled) {
    return;
  }

  if (!notification.url) {
    logger.warn("Update notification URL is not configured");
    return;
  }

  got(notification.url, {
    method: "POST",
    headers: {
      Authorization: notification.authorization ?? "",
      BotToken: config.bot.token,
    },
    json: update,
    retry: { limit: 2 },
    throwHttpErrors: false,
    timeout: { request: 60000 },
  })
    .json()
    .then((response) => {
      if (response) {
        logger.info("Update notification response", { response });
      }
    })
    .catch((error) => {
      logger.error("Update notification failed", { error });
    });
}
