# Family Finance 360

A mobile-first family finance management application.

## Stack
- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts, TanStack Query
- Backend: Python, FastAPI, SQLAlchemy 2, Pydantic, Alembic
- Database: Neon PostgreSQL
- Mobile: PWA with offline transaction drafts
- Version control: GitHub

## Current starter scope
This first implementation milestone provides:
- Responsive finance dashboard
- Family member CRUD interface
- Income/expense transaction entry and list
- Accounts and INR display
- FastAPI health, authentication and CRUD API foundation
- SQLAlchemy models and Alembic-ready structure
- PWA manifest and service worker foundation

Advanced modules (OCR, loans, budgets, recurring transactions, exports, offline conflict resolution) are defined in the roadmap and should be implemented in subsequent tested milestones.

## Security notes
- Passwords are hashed with Argon2 via pwdlib.
- JWT access tokens are short-lived.
- Set a strong `JWT_SECRET_KEY` in production.
- Never commit `.env`.
- Use HTTPS and a managed Neon connection string.
- Configure Neon backups/restore policy and test restores.
- This app is bookkeeping software, not a bank or payment processor.

## Local setup

### Backend
```powershell
cd backend
py -3.12 -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env and set DATABASE_URL and JWT_SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend
```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Frontend: http://localhost:5173  
Backend docs: http://localhost:8000/docs

## GitHub
```powershell
git init
git add .
git commit -m "Initial Family Finance 360 foundation"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/family-finance-360.git
git push -u origin main
```

## Deployment topology
- Frontend: static React build on Render or equivalent.
- Backend: Python web service on Render or equivalent.
- Database: Neon PostgreSQL.
- File storage: private object storage with signed URLs (configure before enabling receipt uploads).

Set frontend `VITE_API_BASE_URL` to the deployed backend URL. Set backend environment variables in the hosting dashboard; do not place secrets in frontend variables.
