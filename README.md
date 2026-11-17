# Family Finance 360

A mobile-first family finance and bookkeeping application built for modern households, powered by **Neon PostgreSQL** and ready for 1-click cloud deployment on **Render**.

---

## Live Features
- **Responsive Household Dashboard**: Real-time monthly income, expenses, net savings, Recharts donut charts, and category expenditure breakdowns.
- **Real-Time Account Balances**: Automatic calculation of live balances across bank accounts, cash, digital wallets, and credit cards.
- **Family Member Tracking**: Bookkeeping profiles for attributing expenses and income to individual family members.
- **Categorized Transactions & CSV Export**: Create, edit, and soft-delete transactions with category and member tags, live search filters, and one-click CSV report downloads.
- **Monthly Category Budgets**: Category limits with visual percentage progress bars and overspending warnings.
- **Dedicated Savings Goals**: Milestone targets with "+ Add funds" deposit tracking.
- **Loans & Borrowing Ledger**: Track money lent to or borrowed from relatives or friends, with partial repayment records and automatic settlement.
- **Security Hardened**: Argon2id password hashing, JWT authentication, sliding-window rate limiting on login/registration, and production security headers.
- **PWA Mobile-First**: Installable Progressive Web App with custom icons and offline application shell.

---

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2, Alembic
- **Database**: [Neon](https://neon.tech/) Serverless Cloud PostgreSQL
- **Cloud Hosting**: [Render](https://render.com/) (FastAPI Web Service + React Static Site)
- **Containerization**: Docker, Docker Compose, Nginx

---

## Quick Cloud Deployment (Render + Neon)

The repository includes a ready-to-use [`render.yaml`](render.yaml) blueprint:

1. Push this project to your GitHub account:
   ```powershell
   git remote add origin https://github.com/YOUR-USERNAME/family-finance-360.git
   git branch -M main
   git push -u origin main
   ```
2. Open the [Render Dashboard](https://dashboard.render.com/) -> **New +** -> **Blueprint**.
3. Select your repository.
4. Provide your Neon PostgreSQL connection string for `DATABASE_URL`.
5. Click **Apply**.
6. Set `VITE_API_BASE_URL` on the frontend static site to your backend URL + `/api/v1`.
7. Share the generated frontend URL (`https://family-finance-360-frontend.onrender.com`) with your family!

Detailed step-by-step instructions with screenshots and mobile installation guidance are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Local Development & Production Run

### Local Production Launcher
- **Windows**: Double-click `run-production.bat`
- **PowerShell**: Run `./start-production.ps1`
- **Docker**: Run `docker compose up --build -d`

### Manual Setup
#### Backend
```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

#### Frontend
```powershell
cd frontend
npm install
npm run dev
```

- Web App: `http://localhost:5173`
- Backend API Docs: `http://localhost:8000/docs`
