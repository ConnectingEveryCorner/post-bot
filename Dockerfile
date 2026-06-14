FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable \
  && corepack prepare pnpm@11.6.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY . .

ENV NODE_ENV=production

CMD ["node", "index.js"]
