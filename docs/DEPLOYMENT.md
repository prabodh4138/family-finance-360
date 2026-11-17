# Cloud Deployment Guide — Render & Neon PostgreSQL

This guide walks you through deploying **Family Finance 360** to the cloud so that you and your relatives can access it securely from any mobile phone, tablet, or computer over HTTPS.

---

## Architecture Topology

```
Relatives / Mobile Phones / Laptops
              │  (HTTPS)
              ▼
   ┌──────────────────────────────────────────────┐
   │ Render Static Site (Frontend SPA)            │
   │ URL: https://family-finance-360-frontend...  │
   └──────────────────────┬───────────────────────┘
                          │  (REST API / JSON)
                          ▼
   ┌──────────────────────────────────────────────┐
   │ Render Web Service (FastAPI Backend)         │
   │ URL: https://family-finance-360-backend...   │
   └──────────────────────┬───────────────────────┘
                          │  (Encrypted SSL Connection)
                          ▼
   ┌──────────────────────────────────────────────┐
   │ Neon Cloud Database (Serverless PostgreSQL)  │
   │ ep-divine-dawn-bdvxrpxa-pooler...            │
   └──────────────────────────────────────────────┘
```

---

## Step 1: Push Code to GitHub

1. Create a new repository on [GitHub](https://github.com/new) named `family-finance-360` (choose **Public** or **Private**).
2. Push your committed local code to GitHub:
   ```powershell
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/family-finance-360.git
   git branch -M main
   git push -u origin main
   ```

*(Note: Secrets and `.env` are already in `.gitignore` and are not committed to GitHub).*

---

## Step 2: Deploy on Render via Blueprint (1-Click)

The repository includes a [render.yaml](../render.yaml) file which configures both the backend and frontend automatically.

1. Go to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** in the top navigation and select **Blueprint**.
3. Connect your GitHub account and select your `family-finance-360` repository.
4. Render will inspect `render.yaml` and show the 2 services:
   - **`family-finance-360-backend`** (Python Web Service)
   - **`family-finance-360-frontend`** (Static Site with SPA rewrites)
5. Under Environment Variables for `family-finance-360-backend`:
   - Set **`DATABASE_URL`** to your Neon PostgreSQL connection string:
     ```
     postgresql+psycopg://neondb_owner:npg_wK6EtCkd7YNI@ep-divine-dawn-bdvxrpxa-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     ```
6. Click **Apply**.
7. Render will automatically:
   - Install dependencies.
   - Run Alembic migrations against your Neon database (`alembic upgrade head`).
   - Build the React TypeScript frontend (`npm run build`).
   - Launch both services with free automated SSL certificates (`https://`).

---

## Step 3: Link Frontend to Backend

1. In your Render Dashboard, find your Backend Web Service URL (e.g. `https://family-finance-360-backend.onrender.com`).
2. Open your Frontend Static Site settings on Render:
   - Go to **Environment**.
   - Set **`VITE_API_BASE_URL`** to your backend URL followed by `/api/v1`:
     ```
     https://family-finance-360-backend.onrender.com/api/v1
     ```
   - Click **Save Changes** (Render will trigger a quick redeploy).

---

## Step 4: Share with Your Relatives

Your frontend site is now live on the internet (e.g. `https://family-finance-360-frontend.onrender.com`)!

### How Relatives Can Use It:
1. **Send the URL**: Send the `https://...onrender.com` link to your family via WhatsApp, Telegram, or email.
2. **Install as Mobile App (PWA)**:
   - **On Android (Chrome)**: Tap the three dots menu (⋮) -> Tap **"Add to Home screen"** or **"Install App"**.
   - **On iOS (Safari)**: Tap the Share button (square with arrow) -> Scroll down and tap **"Add to Home Screen"**.
   - It installs with the custom Family Finance 360 app icon and opens full-screen without browser URL bars.
3. **Collaborative Bookkeeping**:
   - Relatives can sign into the shared family household account to log daily groceries, utility bills, repayments, and view savings progress.
   - Or, different branches of the family can each register their own separate household workspace on the same platform.
