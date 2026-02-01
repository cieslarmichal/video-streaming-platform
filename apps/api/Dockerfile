FROM node:24.11.0-alpine AS base

RUN apk update && apk add --no-cache libc6-compat

WORKDIR /app

FROM base AS pruner

COPY package*.json turbo.json tsconfig.json ./
COPY apps/ ./apps

RUN npx turbo@2.5.8 prune --scope="@apps/api" --docker

FROM base AS installer

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
COPY tsconfig.json ./

RUN npm ci

COPY --from=pruner /app/out/full/ .

RUN npm run build --filter="@apps/api"

FROM base AS runner

ENV NODE_ENV=production
ENV NODE_CONFIG_DIR=/app/apps/api/config

COPY package*.json ./
COPY --from=installer /app/apps/api/dist ./apps/api
COPY --from=installer /app/apps/api/config ./apps/api/config
COPY --from=installer /app/apps/api/package.json ./apps/api/package.json

RUN npm ci --omit=dev

USER node

CMD ["node", "apps/api/src/index.js"]
