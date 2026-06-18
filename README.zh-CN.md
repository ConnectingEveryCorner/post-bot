# Post Bot

[English README](README.md)

Post Bot 是一个 Telegram 帖子资源录入机器人，用来保存和复用单条 Telegram 消息资源

使用 Post Bot 可以做到：

- 📝 录入一条 Telegram 消息作为资源
- 🖼️ 支持文本、图片、GIF、视频、音频、文件、贴纸、联系人、位置、地点等单消息资源
- 📚 分页管理全部资源
- ➕ 给资源添加底部 URL 按钮
- 🔎 通过 inline 模式使用 `@机器人用户名 标识符` 快速发送资源
- 🌐 支持中文和英文界面
- 📊 查看 inline 查询次数和发送次数
- 🐳 使用 Docker Compose 快速部署

示例机器人: [@OpenPostKitBot](https://t.me/OpenPostKitBot) 🤖

![Usage demo](./docs/images/demo.gif)

## 如何使用 ✨

1. 发送 `/start` 打开主菜单 🏠
2. 点击 `录入资源`，发送一条消息作为资源 📝
3. 保存成功后，机器人会发送资源详情消息，并显示资源标识符 🔖
4. 在任意聊天里输入 `@机器人用户名 标识符`，通过 inline 模式发送保存好的资源 🔎
5. 点击 `新增底部按钮`，可以给资源添加 URL 按钮 ➕
6. 点击 `管理资源`，可以查看、刷新、删除和管理全部资源 📚

inline 使用示例：

```text
@OpenPostKitBot 47c309e4
```

## BotFather 设置 ⚠️

使用 inline 模式和发送统计前，需要先在 [@BotFather](https://t.me/BotFather) 配置这两个命令：

- `/setinline` 开启 inline 模式 🔎
- `/setinlinefeedback` 开启 chosen inline result 反馈 📊

不设置 `/setinline`，用户无法通过 `@机器人用户名 标识符` 发送资源
不设置 `/setinlinefeedback`，机器人无法统计 inline 发送数量

底部按钮录入格式：

```text
按钮 A - https://example.com/a
按钮 B - https://example.com/b

按钮 C - https://example.com/c
```

每一行是一个按钮，空一行代表下一排按钮

## Docker Compose 部署 🐳

### 1. 准备配置文件 ⚙️

复制配置模板：

```bash
cp config.example.yaml config.yaml
```

编辑 `config.yaml`，填入你的 Telegram 机器人 token：

```yaml
bot:
  token: YOUR_BOT_TOKEN
```

你也可以配置资源数量限制、客服链接、语言行为，以及 `/start` 和 `/help` 的回复文本：

```yaml
post:
  maxResourcesPerUser: 50
  managePageSize: 5

support:
  url: https://example.com/support
```

### 2. 使用 Docker Compose 启动 🚀

运行：

```bash
docker compose up -d
```

项目内的 `docker-compose.yml` 默认使用：

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

### 3. 持久化文件 📦

请保留这些宿主机目录和文件：

- `./config.yaml` 保存运行配置
- `./data` 保存 SQLite 数据，包括 `post-bot.sqlite`
- `./logs` 保存按天滚动的日志文件

SQLite 数据文件路径：

```text
./data/post-bot.sqlite
```

日志目录：

```text
./logs
```

## 联系方式 💬

- 🤖 机器人: [@ConnectingEveryCornerCNBot](https://t.me/ConnectingEveryCornerCNBot)
- 👤 Telegram: [@ConnectingEveryCorner](https://t.me/ConnectingEveryCorner)
- 📢 频道: [CECCNBoard](https://t.me/CECCNBoard)

## 开源协议 📄

Apache-2.0
