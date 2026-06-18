# Post Bot

[中文文档](README.zh-CN.md)

Post Bot is a Telegram bot for saving and reusing single-message post resources.

With Post Bot, users can:

- 📝 Save one Telegram message as a reusable resource
- 🖼️ Store text, photos, GIFs, videos, audio, documents, stickers, contacts, locations, venues, and more
- 📚 Manage saved resources with pagination
- ➕ Add bottom URL buttons to a resource
- 🔎 Use inline mode with `@bot_username identifier` to send saved resources
- 🌐 Use English or Chinese UI text
- 📊 View inline query and send counters
- 🐳 Deploy easily with Docker Compose

Try the demo bot: [@OpenPostKitBot](https://t.me/OpenPostKitBot) 🤖

![Usage demo](./docs/images/demo.gif)

## How to Use ✨

1. Send `/start` to open the main menu 🏠
2. Tap `Create resource` and send one message as the resource 📝
3. After saving, the bot sends a resource detail message with an identifier 🔖
4. Use `@your_bot_username identifier` in any chat to send the saved resource through inline mode 🔎
5. Tap `Add bottom button` to add URL buttons under the resource ➕
6. Tap `Manage resources` to view, refresh, delete, and manage all saved resources 📚

Example inline usage:

```text
@OpenPostKitBot 47c309e4
```

## BotFather Setup ⚠️

Before using inline mode and send statistics, configure these commands in [@BotFather](https://t.me/BotFather):

- `/setinline` enables inline mode 🔎
- `/setinlinefeedback` enables chosen inline result feedback 📊

Without `/setinline`, users cannot send resources with `@your_bot_username identifier`.
Without `/setinlinefeedback`, the bot cannot count inline sends.

Bottom button input format:

```text
Button A - https://example.com/a
Button B - https://example.com/b

Button C - https://example.com/c
```

Each line is one button. A blank line starts the next button row.

## Docker Compose Deployment 🐳

### 1. Prepare the config file ⚙️

Copy the example config:

```bash
cp config.example.yaml config.yaml
```

Edit `config.yaml` and set your Telegram bot token:

```yaml
bot:
  token: YOUR_BOT_TOKEN
```

You can also configure resource limits, support URL, language behavior, and `/start` or `/help` reply text:

```yaml
post:
  maxResourcesPerUser: 50
  managePageSize: 5

support:
  url: https://example.com/support
```

### 2. Start with Docker Compose 🚀

Run:

```bash
docker compose up -d
```

The included `docker-compose.yml` uses:

```yaml
services:
  post-bot:
    image: ghcr.io/connectingeverycorner/post-bot:latest
    restart: always
    volumes:
      - ./config.yaml:/app/config.yaml:ro
      - ./data:/app/data
      - ./logs:/app/logs
```

### 3. Persistent files 📦

Make sure these host paths are kept:

- `./config.yaml` stores your runtime configuration
- `./data` stores SQLite data, including `post-bot.sqlite`
- `./logs` stores daily rotating log files

SQLite data is stored at:

```text
./data/post-bot.sqlite
```

Logs are written to:

```text
./logs
```

## Contact 💬

- 🤖 Bot: [@ConnectingEveryCornerBot](https://t.me/ConnectingEveryCornerBot)
- 👤 Telegram: [@ConnectingEveryCorner](https://t.me/ConnectingEveryCorner)
- 📢 Channel: [CECBoard](https://t.me/CECBoard)

## License 📄

Apache-2.0
