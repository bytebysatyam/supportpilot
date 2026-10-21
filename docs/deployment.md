# Local and production configuration

## Environment strategy

Root `.env` is private local development configuration. Inject production variables through Vercel and Render. API runtime and Prisma CLI do not load root dotenv files when `NODE_ENV=production`; Vercel builds do not load root dotenv files. Explicit process variables take precedence in development.

The former remote development configuration was preserved privately in ignored `.env.remote-development`. It is not automatically loaded. Do not commit, publish, or share either private file. Use external Render connection URLs only for an intentional remote development session from your PC; Render internal hostnames are reachable from Render services on the appropriate private network.

## Local development

Use Node.js 22 and npm from the repository root. Install/start Docker Desktop first if Docker is unavailable.

```powershell
npm ci
npm run db:generate
npm exec --workspace=@supportpilot/api -- prisma validate
# Start real local services; never run down -v to fix a setup problem.
docker compose up -d postgres redis
npm run db:deploy
npm run db:seed
npm run typecheck
npm test
npm run build
```

Root `.env` uses these non-production values:

```dotenv
NODE_ENV=development
API_PORT=4000
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
DATABASE_URL=postgresql://supportpilot:supportpilot@localhost:5432/supportpilot?schema=public
REDIS_URL=redis://localhost:6379
AI_PROVIDER=disabled
```

Use a random development-only JWT secret of at least 32 characters; keep it private. Remaining defaults are shown in `.env.example`. In three terminals:

```powershell
npm run dev:api
npm run dev:web
npm run dev:worker
```

Frontend: http://localhost:3000. API base: http://localhost:4000/api/v1. Liveness: http://localhost:4000/api/v1/health. Liveness alone does not verify PostgreSQL or Redis. Stop dev processes before reinstalling dependencies or regenerating Prisma on Windows to release native DLL locks.

The checked-in initial migration is `20261020120707_init`. Use `db:deploy` to apply it to a fresh database. Use `db:migrate -- --name descriptive_change` only when developing a new schema change. Never run `migrate dev` in production, generate another initial migration, or reset an existing database to bypass a problem.

## Vercel frontend

Import the existing repository; framework: Next.js; Root Directory: `apps/web`. Include source files outside the Root Directory so the shared workspace package is available. Use these commands relative to that directory:

- Install: `cd ../.. && npm ci --include=dev`
- Build: `cd ../.. && npm run build --workspace=@supportpilot/web`
- Output directory: Next.js default.

Set this variable in Vercel's Production environment:

```dotenv
NEXT_PUBLIC_API_URL=https://supportpilot-4br7.onrender.com/api/v1
```

Redeploy after changing it: Next.js embeds public environment variables during the build. Do not put database, Redis, JWT, or provider credentials in Vercel public variables. Configure preview deployments explicitly and add only trusted preview origins to the API allowlist if needed.

The API base must end in `/api/v1`, without `/health`. Registration must request `https://supportpilot-4br7.onrender.com/api/v1/auth/register`.

## Render API

Use a Node Web Service with repository root as its working directory (leave Root Directory blank). Use Node.js 22. Configure privately in Render:

```dotenv
NODE_ENV=production
WEB_ORIGIN=https://supportpilot-silk.vercel.app
DATABASE_URL=<Render PostgreSQL internal URL>
REDIS_URL=<Render Redis internal URL>
JWT_ACCESS_SECRET=<generated secret of at least 32 characters>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
SLA_SCAN_INTERVAL_MS=300000
AI_PROVIDER=disabled
GROQ_MODEL=llama-3.3-70b-versatile
```

Leave `GROQ_API_KEY` unset while AI is disabled. Render supplies `PORT`; the API binds `0.0.0.0` on that port, falling back to `API_PORT=4000` locally. The same deployment does not need a public API URL environment variable; that variable belongs to the frontend build.

Build command:

```sh
npm ci --include=dev && npm run db:generate --workspace=@supportpilot/api && npm run db:deploy --workspace=@supportpilot/api && npm run build --workspace=@supportpilot/api
```

Start command:

```sh
npm run start --workspace=@supportpilot/api
```

Health Check Path: `/api/v1/health`. Deploy the API/migrations before the worker. Where Render's plan supports a pre-deploy command, migrations can instead run once there; do not run them redundantly in both stages. Build/migration failure must stop deployment. Existing databases with tables but no migration history require a reviewed baselining procedure, not a reset.

## Render worker and Redis

Use a separate Node Background Worker, repository root, and the same private backend variables, database and Redis as the API. Do not deploy the worker as a Vercel function or start it inside the API process.

Worker build:

```sh
npm ci --include=dev && npm run db:generate --workspace=@supportpilot/api && npm run build --workspace=@supportpilot/api
```

Worker start:

```sh
npm run start:worker --workspace=@supportpilot/api
```

Both processes use `REDIS_URL`; `rediss://` enables TLS through ioredis. Do not disable certificate verification. Producers fail promptly when Redis is unavailable; worker connections retry as BullMQ requires. These settings do not establish provider availability or job completion.

Set the Redis provider's `maxmemory-policy` to `noeviction`. Policies such as `allkeys-lru` can evict BullMQ job/lock metadata and undermine queue reliability. If the provider cannot supply `noeviction`, treat that as an unresolved production queue blocker. Check this setting in Render/provider controls or with an authorized read-only `CONFIG GET maxmemory-policy`; no provider setting has been changed automatically. The included local/production Docker Redis services explicitly use `noeviction` and append-only persistence.

## CORS

For separate local/production API deployments, keep one origin per environment. When one API intentionally serves both, set `WEB_ORIGIN` to `http://localhost:3000,https://supportpilot-silk.vercel.app`. Origins are exact HTTP(S) origins, without paths or trailing slashes. Wildcards and embedded credentials are rejected. Unlisted browser origins receive no CORS access; CORS does not replace authentication/RBAC.

## Seed and verification

Seeding is an explicit manual development operation, never a deployment step. `npm run db:seed` requires development mode and a local database. An intentional remote development database additionally requires `npm run db:seed -- --allow-remote-development`. It preserves existing demo users/passwords/tickets and hashes new passwords with bcrypt. Do not use this development fixture seed on a live customer database. A production demo requiring fixtures needs a separately reviewed, manual provisioning step; the development seed remains blocked in production.

See [testing](testing.md) and [current environment verification](environment-verification.md) for results and blockers. No cloud configuration or deployment was changed automatically.

## Docker deployment alternative

`docker-compose.prod.yml` runs web/API/worker and its own PostgreSQL/Redis. It is separate from the Vercel/Render deployment topology. Supply private `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `WEB_ORIGIN`, and the browser-reachable `NEXT_PUBLIC_API_URL` through a private environment file/process environment. Do not publish `docker compose config` output: it interpolates secrets.

```sh
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --wait postgres redis
docker compose -f docker-compose.prod.yml run --rm api npm run db:deploy --workspace=@supportpilot/api
docker compose -f docker-compose.prod.yml up -d api worker web
```

## Platform references

- [Render web service port binding](https://render.com/docs/web-services)
- [Render monorepos](https://render.com/docs/monorepo-support)
- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Next.js public variables are embedded at build time](https://nextjs.org/docs/15/app/guides/environment-variables)
- [BullMQ production Redis requirements](https://docs.bullmq.io/guide/going-to-production)
