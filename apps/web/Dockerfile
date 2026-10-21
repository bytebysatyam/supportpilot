FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/types packages/types

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN test -n "$NEXT_PUBLIC_API_URL" && npm run build --workspace=@supportpilot/web

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static apps/web/.next/static

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
