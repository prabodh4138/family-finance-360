# Deployment plan

## Neon
1. Create a Neon project in a region close to the backend host.
2. Create a dedicated database role with least privilege.
3. Copy the pooled connection string for runtime and direct connection string for migrations if required.
4. Set `DATABASE_URL` as a backend secret.
5. Run Alembic migrations as a release step.
6. Configure backup/restore and test recovery.

## Backend host
- Runtime: Python 3.12+
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Root directory: `backend`
- Environment: `DATABASE_URL`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `ENVIRONMENT=production`

## Frontend host
- Root directory: `frontend`
- Build: `npm ci && npm run build`
- Publish directory: `dist`
- Environment: `VITE_API_BASE_URL=https://YOUR-BACKEND/api/v1`

## GitHub Actions
Add CI for frontend TypeScript/build and backend pytest/ruff. Add deployment hooks only after secrets and environments are configured.
