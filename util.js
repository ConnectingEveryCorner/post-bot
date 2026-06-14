const INLINE_SUPPORTED_TYPES = new Set([
  "text",
  "photo",
  "animation",
  "video",
  "audio",
  "voice",
  "document",
  "sticker",
  "contact",
  "location",
  "venue",
]);

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function code(value) {
  return `<code>${escapeHtml(value)}</code>`;
}

export function bold(value) {
  return `<b>${escapeHtml(value)}</b>`;
}

function getMessageText(message) {
  return message.text ?? message.caption ?? "";
}

function trimTitle(value, fallback) {
  const text = String(value ?? "").replaceAll(/\s+/g, " ").trim();
  if (!text) {
    return fallback;
  }

  return text.length > 48 ? `${text.slice(0, 45)}...` : text;
}

function getLargestPhoto(message) {
  return message.photo?.at(-1);
}

export function parseButtonRowsInput(text) {
  const rowBlocks = String(text ?? "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (rowBlocks.length === 0) {
    return undefined;
  }

  const rows = [];
  for (const block of rowBlocks) {
    const row = [];
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const button = parseButtonLine(line);
      if (!button) {
        return undefined;
      }

      row.push(button);
    }

    if (row.length > 0) {
      rows.push(row);
    }
  }

  return rows.length > 0 ? rows : undefined;
}

function parseButtonLine(line) {
  const [buttonText, rawUrl] = String(line).split(/\s+-\s+/);

  if (!buttonText?.trim() || !rawUrl?.trim()) {
    return undefined;
  }

  try {
    const url = new URL(rawUrl.trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      return undefined;
    }

    return {
      text: buttonText.trim(),
      url: url.toString(),
    };
  } catch {
    return undefined;
  }
}

export function extractSingleMessageResource(message) {
  const base = {
    text: getMessageText(message),
    entities: message.entities ?? message.caption_entities ?? [],
  };

  if (message.text) {
    return {
      type: "text",
      title: trimTitle(message.text, "Text message"),
      message: {
        ...base,
        text: message.text,
      },
    };
  }

  if (message.photo) {
    return {
      type: "photo",
      title: trimTitle(message.caption, "Photo"),
      message: {
        ...base,
        file_id: getLargestPhoto(message).file_id,
      },
    };
  }

  if (message.animation) {
    return {
      type: "animation",
      title: trimTitle(message.caption, "GIF"),
      message: {
        ...base,
        file_id: message.animation.file_id,
      },
    };
  }

  if (message.video) {
    return {
      type: "video",
      title: trimTitle(message.caption, "Video"),
      message: {
        ...base,
        file_id: message.video.file_id,
      },
    };
  }

  if (message.audio) {
    return {
      type: "audio",
      title: trimTitle(message.audio.title ?? message.caption, "Audio"),
      message: {
        ...base,
        file_id: message.audio.file_id,
      },
    };
  }

  if (message.voice) {
    return {
      type: "voice",
      title: trimTitle(message.caption, "Voice"),
      message: {
        ...base,
        file_id: message.voice.file_id,
      },
    };
  }

  if (message.document) {
    return {
      type: "document",
      title: trimTitle(message.document.file_name ?? message.caption, "Document"),
      message: {
        ...base,
        file_id: message.document.file_id,
      },
    };
  }

  if (message.sticker) {
    return {
      type: "sticker",
      title: trimTitle(message.sticker.emoji, "Sticker"),
      message: {
        ...base,
        file_id: message.sticker.file_id,
      },
    };
  }

  if (message.contact) {
    return {
      type: "contact",
      title: trimTitle(message.contact.first_name, "Contact"),
      message: {
        phone_number: message.contact.phone_number,
        first_name: message.contact.first_name,
        last_name: message.contact.last_name,
        vcard: message.contact.vcard,
      },
    };
  }

  if (message.location) {
    return {
      type: "location",
      title: "Location",
      message: {
        latitude: message.location.latitude,
        longitude: message.location.longitude,
      },
    };
  }

  if (message.venue) {
    return {
      type: "venue",
      title: trimTitle(message.venue.title, "Venue"),
      message: {
        latitude: message.venue.location.latitude,
        longitude: message.venue.location.longitude,
        title: message.venue.title,
        address: message.venue.address,
        foursquare_id: message.venue.foursquare_id,
        foursquare_type: message.venue.foursquare_type,
        google_place_id: message.venue.google_place_id,
        google_place_type: message.venue.google_place_type,
      },
    };
  }

  return undefined;
}

export function createResourceReplyMarkup(buttons = []) {
  if (buttons.length === 0) {
    return undefined;
  }

  const rows = [];
  for (const button of buttons) {
    const rowIndex = button.row_index ?? 0;
    rows[rowIndex] ??= [];
    rows[rowIndex].push({
      text: button.text,
      url: button.url,
    });
  }

  return {
    inline_keyboard: rows.filter(Boolean),
  };
}

export function createInlineResult(resource, botUsername) {
  const replyMarkup = createResourceReplyMarkup(resource.buttons);
  const message = resource.message;
  const common = {
    id: String(resource.id),
    title: resource.title,
    description: `@${botUsername} ${resource.identifier}`,
    reply_markup: replyMarkup,
  };

  if (!INLINE_SUPPORTED_TYPES.has(resource.type)) {
    return createUnsupportedResult(resource, common);
  }

  switch (resource.type) {
    case "text":
      return {
        type: "article",
        ...common,
        input_message_content: {
          message_text: escapeHtml(message.text),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        },
      };
    case "photo":
      return {
        type: "photo",
        ...common,
        photo_file_id: message.file_id,
        caption: escapeHtml(message.text),
        parse_mode: "HTML",
      };
    case "animation":
      return {
        type: "gif",
        ...common,
        gif_file_id: message.file_id,
        caption: escapeHtml(message.text),
        parse_mode: "HTML",
      };
    case "video":
      return {
        type: "video",
        ...common,
        video_file_id: message.file_id,
        caption: escapeHtml(message.text),
        parse_mode: "HTML",
      };
    case "audio":
      return {
        type: "audio",
        ...common,
        audio_file_id: message.file_id,
        caption: escapeHtml(message.text),
        parse_mode: "HTML",
      };
    case "voice":
      return {
        type: "voice",
        ...common,
        voice_file_id: message.file_id,
        title: resource.title,
        caption: escapeHtml(message.text),
        parse_mode: "HTML",
      };
    case "document":
      return {
        type: "document",
        ...common,
        document_file_id: message.file_id,
        caption: escapeHtml(message.text),
        parse_mode: "HTML",
      };
    case "sticker":
      return {
        type: "sticker",
        ...common,
        sticker_file_id: message.file_id,
      };
    case "contact":
      return {
        type: "contact",
        ...common,
        phone_number: message.phone_number,
        first_name: message.first_name,
        last_name: message.last_name,
        vcard: message.vcard,
      };
    case "location":
      return {
        type: "location",
        ...common,
        latitude: message.latitude,
        longitude: message.longitude,
      };
    case "venue":
      return {
        type: "venue",
        ...common,
        latitude: message.latitude,
        longitude: message.longitude,
        title: message.title,
        address: message.address,
        foursquare_id: message.foursquare_id,
        foursquare_type: message.foursquare_type,
        google_place_id: message.google_place_id,
        google_place_type: message.google_place_type,
      };
    default:
      return createUnsupportedResult(resource, common);
  }
}

function createUnsupportedResult(resource, common) {
  return {
    type: "article",
    ...common,
    input_message_content: {
      message_text: `Resource ${escapeHtml(resource.identifier)} cannot be sent inline yet.`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    },
  };
}

export function startKeyboard(config, i18n, locale, options = {}) {
  const showLanguage = options.showLanguage ?? !i18n.isLocked;
  const rows = [
    [
      {
        text: i18n.t(locale, "buttons.createResource"),
        callback_data: "record:start",
      },
      {
        text: i18n.t(locale, "buttons.manageResources"),
        callback_data: "manage:1",
      },
    ],
  ];

  const secondRow = [];
  if (config.support?.url) {
    secondRow.push(
      {
        text: i18n.t(locale, "buttons.contactSupport"),
        url: config.support.url,
      },
    );
  }

  if (showLanguage) {
    secondRow.push(
      {
        text: i18n.t(locale, "buttons.chooseLanguage"),
        callback_data: "language:choose",
      },
    );
  }

  if (secondRow.length > 0) {
    rows.push(secondRow);
  }

  return { inline_keyboard: rows };
}

export function cancelKeyboard(i18n, locale) {
  return {
    inline_keyboard: [
      [
        {
          text: i18n.t(locale, "buttons.cancel"),
          callback_data: "state:cancel",
        },
      ],
    ],
  };
}

export function resourceDetailKeyboard(
  resource,
  i18n,
  locale,
  page = 1,
  usageText,
) {
  return {
    inline_keyboard: [
      [
        {
          text: i18n.t(locale, "buttons.copyUsage"),
          copy_text: {
            text: usageText,
          },
        },
      ],
      [
        {
          text: i18n.t(locale, "buttons.refresh"),
          callback_data: `resource:refresh:${resource.id}:${page}`,
        },
      ],
      [
        {
          text: i18n.t(locale, "buttons.addButton"),
          callback_data: `resource:add_button:${resource.id}:${page}`,
        },
        {
          text: i18n.t(locale, "buttons.delete"),
          callback_data: `resource:delete:${resource.id}:${page}`,
        },
      ],
      [
        {
          text: i18n.t(locale, "buttons.backToList"),
          callback_data: `manage:${page}`,
        },
      ],
    ],
  };
}

export function deleteConfirmKeyboard(resource, i18n, locale, page = 1) {
  return {
    inline_keyboard: [
      [
        {
          text: i18n.t(locale, "buttons.cancelDelete"),
          callback_data: `resource:delete_cancel:${resource.id}:${page}`,
        },
        {
          text: i18n.t(locale, "buttons.confirmDelete"),
          callback_data: `resource:delete_confirm:${resource.id}:${page}`,
        },
      ],
    ],
  };
}

export function manageListKeyboard(list, i18n, locale) {
  const rows = list.items.map((resource) => [
    {
      text: `${resource.identifier} · ${resource.title}`,
      callback_data: `resource:view:${resource.id}:${list.page}`,
    },
  ]);

  const nav = [];
  if (list.page > 1) {
    nav.push({
      text: i18n.t(locale, "buttons.previousPage"),
      callback_data: `manage:${list.page - 1}`,
    });
  }

  nav.push({
    text: i18n.t(locale, "buttons.home"),
    callback_data: "home",
  });

  if (list.page < list.totalPages) {
    nav.push({
      text: i18n.t(locale, "buttons.nextPage"),
      callback_data: `manage:${list.page + 1}`,
    });
  }

  rows.push(nav);
  return { inline_keyboard: rows };
}

export function languageKeyboard(i18n, locale) {
  return {
    inline_keyboard: [
      i18n.supportedLocales.map((locale) => ({
        text: i18n.t(locale, "language.name"),
        callback_data: `language:${locale}`,
      })),
      [
        {
          text: i18n.t(locale, "buttons.backHome"),
          callback_data: "home",
        },
      ],
    ],
  };
}

export function resourceDetailText(i18n, locale, resource, botUsername) {
  const usage = `@${botUsername} ${resource.identifier}`;
  const lines = [
    bold(i18n.t(locale, "resource.detailTitle")),
    "",
    `${i18n.t(locale, "resource.identifier")}: ${code(resource.identifier)}`,
    `${i18n.t(locale, "resource.type")}: ${escapeHtml(resource.type)}`,
    `${i18n.t(locale, "resource.title")}: ${escapeHtml(resource.title)}`,
    `${i18n.t(locale, "resource.queryCount")}: ${code(resource.query_count ?? 0)}`,
    `${i18n.t(locale, "resource.sendCount")}: ${code(resource.send_count ?? 0)}`,
    "",
    `${i18n.t(locale, "resource.usage")}: ${code(usage)}`,
    "",
    `${i18n.t(locale, "resource.buttons")}:`,
    ...resourceButtonsText(i18n, locale, resource.buttons),
  ];

  return lines.join("\n");
}

function resourceButtonsText(i18n, locale, buttons = []) {
  if (buttons.length === 0) {
    return [i18n.t(locale, "resource.noButtons")];
  }

  const rows = [];
  for (const button of buttons) {
    const rowIndex = button.row_index ?? 0;
    rows[rowIndex] ??= [];
    rows[rowIndex].push(button);
  }

  return rows.filter(Boolean).flatMap((row, index) => [
    `${i18n.t(locale, "resource.buttonRow", { row: index + 1 })}:`,
    ...row.map((button) => `${code(button.text)} - ${code(button.url)}`),
  ]);
}

export function deleteConfirmText(i18n, locale, resource) {
  return [
    bold(i18n.t(locale, "resource.deleteTitle")),
    "",
    i18n.t(locale, "resource.deleteConfirm"),
    "",
    `${i18n.t(locale, "resource.identifier")}: ${code(resource.identifier)}`,
    `${i18n.t(locale, "resource.title")}: ${escapeHtml(resource.title)}`,
  ].join("\n");
}

export function manageListText(i18n, locale, list) {
  if (list.total === 0) {
    return i18n.t(locale, "resource.emptyList");
  }

  return [
    bold(i18n.t(locale, "resource.manageTitle")),
    "",
    i18n.t(locale, "resource.pageInfo", {
      page: list.page,
      totalPages: list.totalPages,
      total: list.total,
    }),
  ].join("\n");
}

export function buttonInputText(i18n, locale) {
  return [
    i18n.t(locale, "resource.sendButton"),
    "",
    code("Button A - https://example.com/a"),
    code("Button B - https://example.com/b"),
    "",
    code("Button C - https://example.com/c"),
  ].join("\n");
}
