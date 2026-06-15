import { Bot } from "grammy";
import telegram from "./telegram.js";
import { loadConfig, getConfiguredReply } from "./config.js";
import { createI18n } from "./i18n.js";
import { initDatabase } from "./database.js";
import { UserSettings } from "./user-settings-table.js";
import { UserStates } from "./user-states-table.js";
import { Resources } from "./resources-table.js";
import * as util from "./util.js";
import logger from "./logger.js";
import { notifyUpdate } from "./update-notifier.js";

async function getContextLocale(ctx, i18n) {
  if (i18n.isLocked) {
    return i18n.fixedLocale;
  }

  const userLocale = await UserSettings.getLocale(ctx.from?.id);
  return i18n.resolveLocale(userLocale);
}

async function ensurePrivateCallback(config, i18n, ctx) {
  if (ctx.chat?.type === "private") {
    return true;
  }

  const locale = await getContextLocale(ctx, i18n);
  await telegram.answerCallbackQuery(config.bot.token, {
    callback_query_id: ctx.callbackQuery.id,
    text: i18n.t(locale, "messages.privateOnly"),
  });
  return false;
}

async function showHome(config, i18n, ctx, locale) {
  const text = getConfiguredReply(
    config,
    locale,
    "start",
    i18n.t(locale, "commands.start"),
  );

  await telegram.editMessageText(config.bot.token, {
    chat_id: ctx.chat.id,
    message_id: ctx.callbackQuery.message.message_id,
    text,
    reply_markup: util.startKeyboard(config, i18n, locale, {
      showLanguage: ctx.chat?.type === "private" && !i18n.isLocked,
    }),
  });
}

async function showResourceDetail(config, i18n, ctx, resource, botUsername, page = 1) {
  const locale = await getContextLocale(ctx, i18n);

  await telegram.sendMessage(config.bot.token, {
    chat_id: ctx.chat.id,
    text: util.resourceDetailText(i18n, locale, resource, botUsername),
    reply_markup: util.resourceDetailKeyboard(
      resource,
      i18n,
      locale,
      page,
      `@${botUsername} ${resource.identifier}`,
    ),
  });
}

async function editResourceDetail(
  config,
  i18n,
  ctx,
  resource,
  botUsername,
  page = 1,
) {
  const locale = await getContextLocale(ctx, i18n);

  await telegram.editMessageText(config.bot.token, {
    chat_id: ctx.chat.id,
    message_id: ctx.callbackQuery.message.message_id,
    text: util.resourceDetailText(i18n, locale, resource, botUsername),
    reply_markup: util.resourceDetailKeyboard(
      resource,
      i18n,
      locale,
      page,
      `@${botUsername} ${resource.identifier}`,
    ),
  });
}

async function editStateMessage(config, ctx, state, params) {
  const messageId = state?.data?.panelMessageId;

  if (!messageId) {
    await telegram.sendMessage(config.bot.token, {
      chat_id: ctx.chat.id,
      ...params,
    });
    return;
  }

  await telegram.editMessageText(config.bot.token, {
    chat_id: ctx.chat.id,
    message_id: messageId,
    ...params,
  });
}

async function showManageList(config, i18n, ctx, page) {
  const locale = await getContextLocale(ctx, i18n);
  const list = await Resources.listByUser(
    ctx.from.id,
    page,
    config.post.managePageSize,
  );

  await telegram.editMessageText(config.bot.token, {
    chat_id: ctx.chat.id,
    message_id: ctx.callbackQuery.message.message_id,
    text: util.manageListText(i18n, locale, list),
    reply_markup: util.manageListKeyboard(list, i18n, locale),
  });
}

async function sendManageList(config, i18n, ctx, page) {
  const locale = await getContextLocale(ctx, i18n);
  const list = await Resources.listByUser(
    ctx.from.id,
    page,
    config.post.managePageSize,
  );

  await telegram.sendMessage(config.bot.token, {
    chat_id: ctx.chat.id,
    text: util.manageListText(i18n, locale, list),
    reply_markup: util.manageListKeyboard(list, i18n, locale),
  });
}

async function handleRecordingMessage(config, i18n, ctx, botUsername, state) {
  const locale = await getContextLocale(ctx, i18n);
  const total = await Resources.countByUser(ctx.from.id);

  if (total >= config.post.maxResourcesPerUser) {
    await UserStates.clear(ctx.from.id);
    await editStateMessage(config, ctx, state, {
      text: i18n.t(locale, "messages.limitReached", {
        limit: config.post.maxResourcesPerUser,
      }),
      reply_markup: util.startKeyboard(config, i18n, locale),
    });
    return;
  }

  const resourceInput = util.extractSingleMessageResource(ctx.message);
  if (!resourceInput) {
    await editStateMessage(config, ctx, state, {
      text: i18n.t(locale, "messages.unsupportedMessage"),
      reply_markup: util.cancelKeyboard(i18n, locale),
    });
    return;
  }

  const resource = await Resources.create(ctx.from.id, resourceInput);
  await UserStates.clear(ctx.from.id);
  await showResourceDetail(config, i18n, ctx, resource, botUsername);
}

async function handleAddButtonMessage(config, i18n, ctx, botUsername, state) {
  const locale = await getContextLocale(ctx, i18n);
  const resource = await Resources.getById(state.data.resourceId);

  if (!resource || resource.owner_user_id !== String(ctx.from.id)) {
    await UserStates.clear(ctx.from.id);
    await editStateMessage(config, ctx, state, {
      text: i18n.t(locale, "messages.resourceNotFound"),
      reply_markup: util.startKeyboard(config, i18n, locale),
    });
    return;
  }

  const buttonRows = util.parseButtonRowsInput(ctx.message.text);

  if (!buttonRows) {
    await editStateMessage(config, ctx, state, {
      text: `${i18n.t(locale, "messages.invalidButton")}\n\n${util.buttonInputText(
        i18n,
        locale,
      )}`,
      reply_markup: util.cancelKeyboard(i18n, locale),
    });
    return;
  }

  await Resources.replaceButtons(state.data.resourceId, buttonRows);
  await UserStates.clear(ctx.from.id);

  const updatedResource = await Resources.getById(state.data.resourceId);
  await showResourceDetail(config, i18n, ctx, updatedResource, botUsername);
}

async function handleEditSendTextMessage(config, i18n, ctx, botUsername, state) {
  const locale = await getContextLocale(ctx, i18n);
  const resource = await Resources.getById(state.data.resourceId);

  if (!resource || resource.owner_user_id !== String(ctx.from.id)) {
    await UserStates.clear(ctx.from.id);
    await editStateMessage(config, ctx, state, {
      text: i18n.t(locale, "messages.resourceNotFound"),
      reply_markup: util.startKeyboard(config, i18n, locale),
    });
    return;
  }

  if (!util.hasResourceSendText(resource)) {
    await UserStates.clear(ctx.from.id);
    await editStateMessage(config, ctx, state, {
      text: i18n.t(locale, "resource.noSendText"),
      reply_markup: util.resourceDetailKeyboard(
        resource,
        i18n,
        locale,
        Number(state.data.page) || 1,
        `@${botUsername} ${resource.identifier}`,
      ),
    });
    return;
  }

  const sendText = ctx.message.text?.trim();

  if (!sendText) {
    await editStateMessage(config, ctx, state, {
      text: `${i18n.t(locale, "messages.invalidSendText")}\n\n${i18n.t(
        locale,
        "resource.sendEditText",
      )}`,
      reply_markup: util.cancelKeyboard(i18n, locale),
    });
    return;
  }

  const updatedResource = await Resources.updateSendText(
    resource.id,
    ctx.from.id,
    sendText,
  );
  await UserStates.clear(ctx.from.id);
  await showResourceDetail(config, i18n, ctx, updatedResource, botUsername);
}

function registerCommands(bot, config, i18n) {
  bot.command("start", async (ctx) => {
    const locale = await getContextLocale(ctx, i18n);
    const startCount = await UserSettings.incrementStartCount(ctx.from.id);

    await telegram.sendMessage(config.bot.token, {
      chat_id: ctx.chat.id,
      text: getConfiguredReply(
        config,
        locale,
        "start",
        i18n.t(locale, "commands.start"),
      ),
      reply_markup: util.startKeyboard(config, i18n, locale, {
        showLanguage: ctx.chat?.type === "private" && !i18n.isLocked,
      }),
    });

    if (!i18n.isLocked && startCount <= 2 && ctx.chat?.type === "private") {
      await telegram.sendMessage(config.bot.token, {
        chat_id: ctx.chat.id,
        text: i18n.t(locale, "commands.language"),
        reply_markup: util.languageKeyboard(i18n, locale),
      });
    }
  });

  bot.command("help", async (ctx) => {
    const locale = await getContextLocale(ctx, i18n);
    await telegram.sendMessage(config.bot.token, {
      chat_id: ctx.chat.id,
      text: getConfiguredReply(
        config,
        locale,
        "help",
        i18n.t(locale, "commands.help"),
      ),
    });
  });

  bot.command("language", async (ctx) => {
    const locale = await getContextLocale(ctx, i18n);

    if (i18n.isLocked) {
      await telegram.sendMessage(config.bot.token, {
        chat_id: ctx.chat.id,
        text: i18n.t(locale, "commands.languageLocked"),
      });
      return;
    }

    await telegram.sendMessage(config.bot.token, {
      chat_id: ctx.chat.id,
      text: i18n.t(locale, "commands.language"),
      reply_markup: util.languageKeyboard(i18n, locale),
    });
  });
}

function registerCallbacks(bot, config, i18n, botUsername) {
  bot.callbackQuery("home", async (ctx) => {
    const locale = await getContextLocale(ctx, i18n);
    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
    });
    await showHome(config, i18n, ctx, locale);
  });

  bot.callbackQuery("record:start", async (ctx) => {
    if (!(await ensurePrivateCallback(config, i18n, ctx))) {
      return;
    }

    const locale = await getContextLocale(ctx, i18n);
    await UserStates.set(ctx.from.id, "record_resource", {
      panelMessageId: ctx.callbackQuery.message.message_id,
    });
    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
    });
    await telegram.editMessageText(config.bot.token, {
      chat_id: ctx.chat.id,
      message_id: ctx.callbackQuery.message.message_id,
      text: i18n.t(locale, "resource.sendResource"),
      reply_markup: util.cancelKeyboard(i18n, locale),
    });
  });

  bot.callbackQuery("state:cancel", async (ctx) => {
    if (!(await ensurePrivateCallback(config, i18n, ctx))) {
      return;
    }

    const locale = await getContextLocale(ctx, i18n);
    const state = await UserStates.get(ctx.from.id);
    await UserStates.clear(ctx.from.id);
    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
      text: i18n.t(locale, "messages.cancelled"),
    });

    if (state?.step === "add_button") {
      const resource = await Resources.getById(state.data.resourceId);
      const page = Number(state.data.page) || 1;

      if (resource && resource.owner_user_id === String(ctx.from.id)) {
        await editResourceDetail(config, i18n, ctx, resource, botUsername, page);
        return;
      }

      await showManageList(config, i18n, ctx, page);
      return;
    }

    if (state?.step === "edit_send_text") {
      const resource = await Resources.getById(state.data.resourceId);
      const page = Number(state.data.page) || 1;

      if (resource && resource.owner_user_id === String(ctx.from.id)) {
        await editResourceDetail(config, i18n, ctx, resource, botUsername, page);
        return;
      }

      await showManageList(config, i18n, ctx, page);
      return;
    }

    await showHome(config, i18n, ctx, locale);
  });

  bot.callbackQuery(/^manage:(\d+)$/, async (ctx) => {
    if (!(await ensurePrivateCallback(config, i18n, ctx))) {
      return;
    }

    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
    });
    await showManageList(config, i18n, ctx, Number(ctx.match[1]));
  });

  bot.callbackQuery(/^resource:view:(\d+):(\d+)$/, async (ctx) => {
    if (!(await ensurePrivateCallback(config, i18n, ctx))) {
      return;
    }

    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
    });
    const resource = await Resources.getById(Number(ctx.match[1]));

    if (!resource || resource.owner_user_id !== String(ctx.from.id)) {
      const locale = await getContextLocale(ctx, i18n);
      await telegram.sendMessage(config.bot.token, {
        chat_id: ctx.chat.id,
        text: i18n.t(locale, "messages.resourceNotFound"),
      });
      return;
    }

    await editResourceDetail(
      config,
      i18n,
      ctx,
      resource,
      botUsername,
      Number(ctx.match[2]),
    );
  });

  bot.callbackQuery(/^resource:refresh:(\d+):(\d+)(?::[a-f0-9]+)?$/, async (ctx) => {
    if (!(await ensurePrivateCallback(config, i18n, ctx))) {
      return;
    }

    const locale = await getContextLocale(ctx, i18n);
    const resource = await Resources.getById(Number(ctx.match[1]));
    const page = Number(ctx.match[2]) || 1;

    if (!resource || resource.owner_user_id !== String(ctx.from.id)) {
      await telegram.answerCallbackQuery(config.bot.token, {
        callback_query_id: ctx.callbackQuery.id,
        text: i18n.t(locale, "messages.resourceNotFound"),
      });
      return;
    }

    try {
      await editResourceDetail(config, i18n, ctx, resource, botUsername, page);
    } catch (error) {
      if (String(error.message).includes("message is not modified")) {
        await telegram.answerCallbackQuery(config.bot.token, {
          callback_query_id: ctx.callbackQuery.id,
          text: i18n.t(locale, "messages.resourceLatest"),
        });
        return;
      }

      throw error;
    }

    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
    });
  });

  bot.callbackQuery(/^resource:delete:(\d+)(?::(\d+))?$/, async (ctx) => {
    if (!(await ensurePrivateCallback(config, i18n, ctx))) {
      return;
    }

    const locale = await getContextLocale(ctx, i18n);
    const resource = await Resources.getById(Number(ctx.match[1]));
    const page = Number(ctx.match[2]) || 1;

    if (!resource || resource.owner_user_id !== String(ctx.from.id)) {
      await telegram.answerCallbackQuery(config.bot.token, {
        callback_query_id: ctx.callbackQuery.id,
        text: i18n.t(locale, "messages.resourceNotFound"),
      });
      return;
    }

    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
    });
    await telegram.editMessageText(config.bot.token, {
      chat_id: ctx.chat.id,
      message_id: ctx.callbackQuery.message.message_id,
      text: util.deleteConfirmText(i18n, locale, resource),
      reply_markup: util.deleteConfirmKeyboard(resource, i18n, locale, page),
    });
  });

  bot.callbackQuery(/^resource:delete_cancel:(\d+):(\d+)$/, async (ctx) => {
    if (!(await ensurePrivateCallback(config, i18n, ctx))) {
      return;
    }

    const locale = await getContextLocale(ctx, i18n);
    const resource = await Resources.getById(Number(ctx.match[1]));
    const page = Number(ctx.match[2]) || 1;

    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
    });

    if (!resource || resource.owner_user_id !== String(ctx.from.id)) {
      await showManageList(config, i18n, ctx, page);
      return;
    }

    await editResourceDetail(config, i18n, ctx, resource, botUsername, page);
  });

  bot.callbackQuery(/^resource:delete_confirm:(\d+):(\d+)$/, async (ctx) => {
    if (!(await ensurePrivateCallback(config, i18n, ctx))) {
      return;
    }

    const locale = await getContextLocale(ctx, i18n);
    const resource = await Resources.getById(Number(ctx.match[1]));
    const page = Number(ctx.match[2]) || 1;

    if (!resource || resource.owner_user_id !== String(ctx.from.id)) {
      await telegram.answerCallbackQuery(config.bot.token, {
        callback_query_id: ctx.callbackQuery.id,
        text: i18n.t(locale, "messages.resourceNotFound"),
      });
      await showManageList(config, i18n, ctx, page);
      return;
    }

    await Resources.deleteByIdForUser(resource.id, ctx.from.id);
    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
      text: i18n.t(locale, "messages.resourceDeleted"),
    });
    await showManageList(config, i18n, ctx, page);
  });

  bot.callbackQuery(/^resource:add_button:(\d+)(?::(\d+))?$/, async (ctx) => {
    if (!(await ensurePrivateCallback(config, i18n, ctx))) {
      return;
    }

    const locale = await getContextLocale(ctx, i18n);
    const resource = await Resources.getById(Number(ctx.match[1]));
    const page = Number(ctx.match[2]) || 1;

    if (!resource || resource.owner_user_id !== String(ctx.from.id)) {
      await telegram.answerCallbackQuery(config.bot.token, {
        callback_query_id: ctx.callbackQuery.id,
        text: i18n.t(locale, "messages.resourceNotFound"),
      });
      return;
    }

    await UserStates.set(ctx.from.id, "add_button", {
      resourceId: resource.id,
      page,
      panelMessageId: ctx.callbackQuery.message.message_id,
    });
    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
    });
    await telegram.editMessageText(config.bot.token, {
      chat_id: ctx.chat.id,
      message_id: ctx.callbackQuery.message.message_id,
      text: util.buttonInputText(i18n, locale),
      reply_markup: util.cancelKeyboard(i18n, locale),
    });
  });

  bot.callbackQuery(/^resource:edit_text:(\d+)(?::(\d+))?$/, async (ctx) => {
    if (!(await ensurePrivateCallback(config, i18n, ctx))) {
      return;
    }

    const locale = await getContextLocale(ctx, i18n);
    const resource = await Resources.getById(Number(ctx.match[1]));
    const page = Number(ctx.match[2]) || 1;

    if (!resource || resource.owner_user_id !== String(ctx.from.id)) {
      await telegram.answerCallbackQuery(config.bot.token, {
        callback_query_id: ctx.callbackQuery.id,
        text: i18n.t(locale, "messages.resourceNotFound"),
      });
      return;
    }

    if (!util.hasResourceSendText(resource)) {
      await telegram.answerCallbackQuery(config.bot.token, {
        callback_query_id: ctx.callbackQuery.id,
        text: i18n.t(locale, "resource.noSendText"),
      });
      return;
    }

    await UserStates.set(ctx.from.id, "edit_send_text", {
      resourceId: resource.id,
      page,
      panelMessageId: ctx.callbackQuery.message.message_id,
    });
    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
    });
    await telegram.editMessageText(config.bot.token, {
      chat_id: ctx.chat.id,
      message_id: ctx.callbackQuery.message.message_id,
      text: i18n.t(locale, "resource.sendEditText"),
      reply_markup: util.cancelKeyboard(i18n, locale),
    });
  });

  bot.callbackQuery(/^language:(.+)$/, async (ctx) => {
    const selectedLocale = ctx.match[1];
    const currentLocale = await getContextLocale(ctx, i18n);

    if (selectedLocale === "choose") {
      await telegram.answerCallbackQuery(config.bot.token, {
        callback_query_id: ctx.callbackQuery.id,
      });
      await telegram.editMessageText(config.bot.token, {
        chat_id: ctx.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        text: i18n.t(currentLocale, "commands.language"),
        reply_markup: util.languageKeyboard(i18n, currentLocale),
      });
      return;
    }

    if (i18n.isLocked) {
      await telegram.answerCallbackQuery(config.bot.token, {
        callback_query_id: ctx.callbackQuery.id,
        text: i18n.t(currentLocale, "commands.languageLocked"),
        show_alert: true,
      });
      return;
    }

    if (!i18n.supportedLocales.includes(selectedLocale)) {
      await telegram.answerCallbackQuery(config.bot.token, {
        callback_query_id: ctx.callbackQuery.id,
        text: i18n.t(currentLocale, "messages.unsupportedLanguage"),
        show_alert: true,
      });
      return;
    }

    await UserSettings.save(ctx.from.id, { locale: selectedLocale });
    await telegram.answerCallbackQuery(config.bot.token, {
      callback_query_id: ctx.callbackQuery.id,
      text: i18n.t(selectedLocale, "messages.languageChanged"),
    });
    await util.sleep(1000);
    await showHome(config, i18n, ctx, selectedLocale);
  });
}

function registerMessages(bot, config, i18n, botUsername) {
  bot.on("message", async (ctx) => {
    const state = await UserStates.get(ctx.from?.id);
    const locale = await getContextLocale(ctx, i18n);

    if (state?.step === "record_resource") {
      await handleRecordingMessage(config, i18n, ctx, botUsername, state);
      return;
    }

    if (state?.step === "add_button") {
      await handleAddButtonMessage(config, i18n, ctx, botUsername, state);
      return;
    }

    if (state?.step === "edit_send_text") {
      await handleEditSendTextMessage(config, i18n, ctx, botUsername, state);
      return;
    }

    if (ctx.message.text?.startsWith("/")) {
      await telegram.sendMessage(config.bot.token, {
        chat_id: ctx.chat.id,
        text: i18n.t(locale, "messages.unknownCommand"),
      });
      return;
    }
  });
}

function registerInlineQueries(bot, config, botUsername) {
  bot.on("inline_query", async (ctx) => {
    const identifier = ctx.inlineQuery.query.trim().split(/\s+/)[0];
    const resource = identifier
      ? await Resources.getByIdentifier(identifier)
      : undefined;
    const results = resource ? [util.createInlineResult(resource, botUsername)] : [];

    if (resource) {
      await Resources.incrementQueryCount(resource.id);
    }

    await telegram.answerInlineQuery(config.bot.token, {
      inline_query_id: ctx.inlineQuery.id,
      results,
      cache_time: 0,
      is_personal: true,
    });
  });

  bot.on("chosen_inline_result", async (ctx) => {
    const resourceId = Number(ctx.chosenInlineResult.result_id);

    if (Number.isInteger(resourceId)) {
      await Resources.incrementSendCount(resourceId);
    }
  });
}

function createBot(config, i18n, botUsername) {
  const bot = new Bot(config.bot.token);

  bot.use(async (ctx, next) => {
    notifyUpdate(config, ctx.update);
    await next();
  });

  registerCommands(bot, config, i18n);
  registerCallbacks(bot, config, i18n, botUsername);
  registerMessages(bot, config, i18n, botUsername);
  registerInlineQueries(bot, config, botUsername);

  bot.catch((err) => {
    logger.error("Bot handler error", { error: err.error });
  });

  return bot;
}

function createBotCommands(i18n, locale) {
  const commands = [
    {
      command: "start",
      description: i18n.t(locale, "commands.menuStart"),
    },
    {
      command: "help",
      description: i18n.t(locale, "commands.menuHelp"),
    },
  ];

  return commands;
}

async function setupBotMenu(config, i18n) {
  for (const locale of i18n.supportedLocales) {
    await telegram.setMyCommands(config.bot.token, {
      commands: createBotCommands(i18n, locale),
      language_code: locale,
    });
  }

  await telegram.setMyCommands(config.bot.token, {
    commands: createBotCommands(i18n, i18n.fixedLocale ?? i18n.defaultLocale),
  });
}

async function runBot(config, i18n, botUsername) {
  const bot = createBot(config, i18n, botUsername);
  logger.info("Bot is running", { username: botUsername });
  await bot.start();
}

async function main() {
  const config = await loadConfig();
  const i18n = await createI18n(config.i18n);
  await initDatabase();
  await UserSettings.init();
  await UserStates.init();
  await Resources.init();

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error });
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", { error: reason });
  });

  process.on("warning", (warning) => {
    logger.error("Process warning", { error: warning });
  });

  const botInfo = await telegram.getMe(config.bot.token);
  await setupBotMenu(config, i18n);
  await runBot(config, i18n, botInfo.username);
}

main().catch((error) => {
  logger.error("Fatal startup error", { error });
  process.exit(1);
});
