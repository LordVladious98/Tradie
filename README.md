# TradieFlow MVP
Monorepo for TradieFlow (NestJS API + Expo mobile + shared package).

## Quickstart
```bash
pnpm install
cp .env.example .env
cp .env.example apps/api/.env
pnpm dev
pnpm db:migrate
pnpm db:seed
```

## Scripts
- `pnpm dev` start postgres and API
- `pnpm db:migrate` run Prisma migration
- `pnpm db:seed` seed demo data
- `pnpm test` run API tests

See docs in `/docs`.
