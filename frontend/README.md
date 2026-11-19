# VELAAN IQ (வேளாண் IQ) — Frontend

> Soybean Procurement Intelligence & Decision Support Platform for ABT-CPD.

A modern, premium agri-tech SaaS web interface answering the three core procurement questions:
1. **WHEN** should soybean be purchased?
2. **HOW MUCH** quantity should be ordered?
3. **WHICH ROUTE** minimizes landed cost (Domestic Mandi vs International Import)?

---

## Tech Stack
- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS with custom agri-tech theme tokens (deep forest green `#14432A`, leaf green `#3E9B5F`, soybean cream `#F6F1E4`, harvest gold `#D9A441`, earth brown `#6B4F2A`, ink `#1F2A24`)
- **Typography:** Fraunces (serif for numbers and headers), Plus Jakarta Sans (UI text), Noto Sans Tamil (Tamil brand wordmark)
- **Routing:** React Router v7 (`react-router-dom`)
- **Visualizations:** Recharts for historical price trajectories and landed cost breakdown charts
- **Icons:** Lucide React
- **API Client:** Native fetch with Bearer token authentication, 401/403 auto-invalidation, and FastAPI 422 error normalization

---

## Installation & Local Development

### Prerequisites
- Node.js (v18+)
- Backend running at `http://127.0.0.1:8000`

### 1. Environment Configuration
Create a `.env` file in `frontend/` (or copy from `.env.example`):
```bash
VITE_API_URL=http://127.0.0.1:8000
```

### 2. Install Dependencies
```bash
cd frontend
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
The application will launch at `http://localhost:5173`.

### 4. Build for Production
```bash
npm run build
npm run preview
```

---

## Deployment Guide

The frontend is fully configured and ready for production deployment across multiple platforms.

### Option 1: Vercel (Recommended for instant deployment)
1. Push your repository to GitHub / GitLab.
2. In Vercel, import the repository and set **Root Directory** to `frontend`.
3. Set **Framework Preset** to `Vite`.
4. In **Environment Variables**, set:
   - `VITE_API_URL`: Your deployed backend URL (e.g. `https://api.yourdomain.com`).
5. Click **Deploy**. (The included `vercel.json` automatically handles SPA routing rewrites).

### Option 2: Netlify / Render / Cloudflare Pages
1. Set **Base directory**: `frontend`
2. Set **Build command**: `npm run build`
3. Set **Publish directory**: `frontend/dist`
4. Add environment variable `VITE_API_URL`: Your deployed backend URL.
5. The included `public/_redirects` file automatically handles single-page application routing.

### Option 3: Docker Deployment
A production-ready multi-stage `Dockerfile` and `nginx.conf` are included:
```bash
cd frontend
docker build -t velaan-iq-frontend .
docker run -d -p 80:80 --name velaan-app velaan-iq-frontend
```

---

## Backend Deployment Checklist

When deploying the FastAPI backend alongside the frontend:
1. **CORS Origins:** In `backend/.env`, update `CORS_ORIGINS` to include your production frontend URL (e.g., `CORS_ORIGINS=https://velaan-iq.vercel.app,http://localhost:5173`).
2. **MongoDB Atlas IP Access:** In MongoDB Atlas, go to **Network Access** and ensure your hosting provider's IP (or `0.0.0.0/0` with database credentials) is allowed.
3. **JWT Secret:** Ensure `JWT_SECRET` is set to a secure random token in production environment variables.

---

## Pages & Feature Modules

1. **Authentication (`/login`)**
   - Split layout with soybean botanical pattern artwork on the left and login/registration on the right.
   - Inline form validation (passwords min 8 characters), session expiration notification, and quick demo credentials auto-fill button.

2. **Executive Command Centre (`/dashboard`)**
   - KPI metrics: Net usable stock, coverage days, incoming PO volume, and current recommendation badge.
   - Silo warehouse storage gauge (usable vs capacity limits).
   - Domestic vs International benchmark price cards with data-quality and staleness indicators.
   - USD/INR reference exchange rate card.
   - 7-Day price forecast with direction indicators and statistical disclaimer.
   - Latest decision card with full reasoning chain and direct action button to run the Advisor.
   - Operational alerts panel highlighting `SIMULATED_DATA` warnings and stale feeds.

3. **Procurement Advisor (`/advisor`)**
   - Decision support engine calculating King's formula safety stock, reorder point (ROP), and multi-supplier order allocation.
   - Input controls grouped by Planning, Buffers, and Financial/Tax assumptions.
   - Customs duty input as percentage in UI (sent as fraction).
   - Three Answer Hero Cards (When, How Much, Which Route).
   - Landed cost benchmark bar chart comparing domestic vs imported totals.
   - Decision audit history table with expandable reasoning notes.

4. **Scenario Simulator (`/scenarios`)**
   - Interactive what-if simulation testing price shocks (-30% to +50%), FX rate shifts, freight spikes, consumption shifts, inventory adjustments, and lead time variations.
   - One-click presets: "Rupee weakens 5%", "Demand +30%", "Extra 9,000 MT stock", "Freight spike +40%".
   - Clear decision shift banner ("Decision Changed" vs "Decision Unchanged") and side-by-side Baseline vs Simulated comparison table.
   - Strictly isolated: never alters real records or database inventory.

5. **Market & Forecast (`/market`)**
   - 30-day market summary benchmark cards (min, mean, max, 7d/30d percentage moves).
   - Chronological price history line chart with market type and specific market selector.
   - Exponential smoothing forecast with baseline fallback validation, backtest metrics (MAE, RMSE, MAPE comparison), and mandatory statistical estimate disclaimer.

6. **Sourcing Compare (`/sourcing`)**
   - Two-column landed cost calculator comparing Domestic mandi quotes vs International global cargo.
   - Incoterm selector (FOB, CFR, CIF) with contextual explanations.
   - Component cost breakdown bars and tolerance threshold analysis.

7. **Data Management Console (`/data`)**
   - **Inventory Snapshot:** Current physical balance and dated snapshot logger.
   - **Consumption:** 30-day daily crushing log and statistical mean tracker.
   - **Suppliers:** Master catalog of contracted domestic and global suppliers with MOQ and lead times.
   - **Purchase Orders:** Open PO shipment tracker and arrival ETA recorder.
   - **Exchange Rates:** USD/INR benchmark rate recorder.
   - **Market Prices & Upload:** Paginated price series table, manual spot entry form, drag-and-drop CSV/XLSX file uploader, and sample CSV template generator.

---

## Data & Honesty Disclaimers
- Output is strictly decision-support and rule-based recommendation.
- When demo data is in use, a persistent, session-dismissible banner alerts the user: *"Demo data: values are simulated, not real market prices."*
- Forecasts always display: *"Statistical estimate based on historical prices. Not a guaranteed market price."*
