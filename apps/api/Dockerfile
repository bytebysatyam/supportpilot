FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json

RUN npm install

COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/types packages/types

RUN npm run db:generate --workspace=@supportpilot/api
RUN npm run build --workspace=@supportpilot/api

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json

RUN npm install --omit=dev

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma node_modules/@prisma

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace=@supportpilot/api"]
