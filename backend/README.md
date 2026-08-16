# POS Backend

A REST API for a multi-store point-of-sale system, built on the
[Litestar Fullstack](https://github.com/litestar-org/litestar-fullstack)
template (Litestar + SQLAlchemy 2.0 / Advanced Alchemy + Alembic + PostgreSQL,
JWT auth with refresh tokens, background jobs via SAQ/Redis).

It's designed to be paired with the Next.js frontend in `../frontend`, but is
a standalone JSON API and can be used with any frontend.

## What's included

- **Accounts & teams** (from the base template): signup/login, JWT access +
  refresh tokens, email verification, password reset, optional MFA and OAuth,
  and a "team" concept representing a business.
- **POS domain** (`src/py/app/domain/pos`): stores, product categories,
  products, per-store inventory, customers, and point-of-sale transactions
  (checkout, voids, refunds), plus basic dashboard/reporting endpoints.

### Roles

Each staff member (`TeamMember`) has a role scoped to their business (team):

- `ADMIN` — full access to every store owned by the business.
- `MANAGER` — full access to their assigned store only.
- `CASHIER` — checkout access only, scoped to their assigned store.

A business can have multiple stores; products/categories/customers are
shared across a business's stores, while inventory and sales are tracked
per-store.

## Quick start (local, no Docker)

Requires Python 3.11-3.13, PostgreSQL, and Redis running locally.

```bash
cp .env.local.example .env      # adjust DB/Redis connection info if needed
make install                    # uv sync
make migrate                    # apply database migrations
make seed                       # create default roles
make dev                        # runs on http://localhost:8000
```

The interactive API docs (Scalar) are served at `http://localhost:8000/schema`.

## Quick start (Docker)

From the repository root (one level up), `docker compose up` starts Postgres,
Redis, this API, and the Next.js frontend together. See the root `README.md`.

## Creating your first login

There's no seeded demo user. Sign up through the frontend (or `POST
/api/access/signup`), then create a business and store either through the
frontend's onboarding screen or directly:

```bash
# 1. Sign up, then log in to get an access token
# 2. POST /api/teams              {"name": "My Shop"}
# 3. POST /api/teams/{team_id}/stores   {"name": "Main Store"}
```

The user who creates a team is automatically added as its `ADMIN` (and
owner).

## Useful commands

Run `make help` for the full list. The most common ones:

| Command | Description |
| --- | --- |
| `make dev` | Run the API with auto-reload |
| `make migrate` | Apply database migrations |
| `make makemigrations msg="..."` | Autogenerate a new migration |
| `make seed` | Create default system roles |
| `make lint` / `make format` | Ruff lint / format |
| `make test` | Run the test suite |

You can also use the `app` CLI directly (e.g. `uv run app database upgrade`,
`uv run app users create-user`, `uv run app users promote-to-superuser`).

## Environment variables

See `.env.local.example` for the full list with descriptions. At minimum,
you'll need `DATABASE_URL` (or the individual `DATABASE_*` vars), `SAQ_REDIS_URL`,
`SECRET_KEY`, and `ALLOWED_CORS_ORIGINS` (must exactly match the frontend's
origin, since cookies are used for refresh tokens).
