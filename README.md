# POS (Point of Sale)

A multi-store point-of-sale system: a Next.js (App Router, TypeScript) frontend
and a Litestar (Python) backend API adapted from the
[Litestar Fullstack](https://github.com/litestar-org/litestar-fullstack) template.

```
pos-project/
├── backend/    # Litestar API: auth, teams/businesses, stores, products,
│               # inventory, customers, sales/checkout, reporting
├── frontend/   # Next.js app: login/signup, dashboard, checkout screen,
│               # product/inventory/customer management, sales history
└── docker-compose.yml
```

## Features

- Email/password signup & login (JWT access token + httponly refresh cookie).
- A business ("team") can have **multiple stores**. Products, categories,
  and customers are shared across a business; inventory and sales are
  tracked per-store.
- Staff roles per business: `ADMIN` (all stores), `MANAGER` (their assigned
  store), `CASHIER` (checkout only, their assigned store).
- Checkout flow: cart → tax/discount calculation → payment → stock
  decrement, all in one transaction. Voiding/refunding a sale restocks it.
- Dashboard with today's/this week's sales, top products, and low-stock
  alerts.
- Sales history with receipts.

## Running it

### Option A: Docker Compose (easiest)

From this directory:

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, the backend (on `:8000`, running migrations
automatically on boot), and the frontend (on `:3000`). Open
`http://localhost:3000`, sign up, and follow the onboarding screen to create
your business and first store.

### Option B: Run locally without Docker

You'll need PostgreSQL, Redis, Python 3.11-3.13, and Node.js 20+ installed.

```bash
# Backend
cd backend
cp .env.local.example .env      # edit if your DB/Redis aren't on localhost defaults
make install
make migrate
make seed
make dev                        # http://localhost:8000

# Frontend (separate terminal)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

## Environment variables

### Backend (`backend/.env`, see `backend/.env.local.example`)

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `SECRET_KEY` | Yes (prod) | random on boot | Used to sign JWTs; set a fixed value in production or every restart invalidates sessions. |
| `DATABASE_URL` | Yes | `postgresql+psycopg://app:app@localhost:5432/app` | Or set the individual `DATABASE_USER`/`PASSWORD`/`HOST`/`PORT`/`DB` vars instead. |
| `SAQ_REDIS_URL` | Yes | `redis://localhost:6379/0` | Used for background jobs (token cleanup, OAuth refresh). |
| `ALLOWED_CORS_ORIGINS` | Yes | `["http://localhost:3000","http://127.0.0.1:3000"]` | Must exactly match the frontend's origin(s) — required for the refresh-token cookie to work cross-origin. |
| `LITESTAR_HOST` / `LITESTAR_PORT` | No | `0.0.0.0` / `8000` | |
| `LITESTAR_DEBUG` | No | `false` | Set `true` for local dev (verbose error pages). |
| `COOKIE_SECURE` | No | `false` | Set `true` once serving both apps over HTTPS. |
| `EMAIL_BACKEND` | No | `console` | `console` (prints to stdout), `smtp`, or `resend`. Only needed for password-reset/verification emails. |
| `EMAIL_SMTP_*` | No | — | Only used when `EMAIL_BACKEND=smtp`. |
| `RESEND_API_KEY` | No | — | Only used when `EMAIL_BACKEND=resend`. |
| `GOOGLE_OAUTH2_CLIENT_ID` / `_SECRET` | No | — | Enables "Sign in with Google". Leave blank to disable. |
| `GITHUB_OAUTH2_CLIENT_ID` / `_SECRET` | No | — | Enables "Sign in with GitHub". Leave blank to disable. |

### Frontend (`frontend/.env.local`, see `frontend/.env.local.example`)

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000` | Base URL of the backend API, reachable from the browser. |

## How auth works (for reference)

Login (`POST /api/access/login`) returns a short-lived JWT access token in
the response body and sets an httponly refresh-token cookie (scoped to
`/api/access`). The frontend keeps the access token in memory/localStorage
and sends it as `Authorization: Bearer <token>`; on a 401 it silently calls
`/api/access/refresh` (which relies on the cookie) and retries once. This is
why `ALLOWED_CORS_ORIGINS` must list the frontend's exact origin rather than
`*` — cross-origin cookies require it.

## Extending it

- The backend's POS domain lives in `backend/src/py/app/domain/pos/` —
  models are in `backend/src/py/app/db/models/`, and there's a single
  Alembic migration for the POS tables in
  `backend/src/py/app/db/migrations/versions/`.
- API docs (Scalar, generated from the OpenAPI schema) are served at
  `http://localhost:8000/schema` once the backend is running.
- Staff management (inviting a cashier/manager to a store) reuses the base
  template's team invitation endpoints under `/api/teams/{team_id}/members`
  and `/api/teams/{team_id}/invitations` — the frontend doesn't have a
  screen for this yet, so use the API directly or add one.

### Option C: Deploy for free, without a credit card

See [`DEPLOY.md`](./DEPLOY.md) for step-by-step instructions using Neon
(Postgres), Upstash (Redis), Render (backend), and Vercel (frontend) — all
free tiers that don't require a card. `render.yaml` in this repo is a Render
Blueprint for the backend.