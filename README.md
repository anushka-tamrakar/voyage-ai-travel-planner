# Personalized Travel Itinerary Planner (VoyageAI)

Full-stack AI SaaS generating geographically optimized travel itineraries with Google Gemini & Supabase.

## Environment Variables

### Backend (`backend/.env`)
- `JWT_SECRET`: Secret key for JWT signing (min 32 chars)
- `SUPABASE_URL`: Supabase project URL (`https://xyz.supabase.co`)
- `SUPABASE_KEY`: Supabase API / service role key
- `GEMINI_API_KEY`: Google AI Studio Gemini API key
- `GEMINI_MODEL`: `gemini-1.5-flash`
- `ALLOW_ORIGINS`: Allowed CORS origins (`http://localhost:5173`)
- `CORS_ORIGINS`: Comma-separated allowed frontend origins (e.g. `https://your-app.vercel.app`)

### Frontend (`frontend/.env`)
- `VITE_API_URL`: Backend URL (e.g. `https://your-backend.onrender.com` or `http://localhost:8000`)
- `VITE_API_BASE_URL`: Legacy fallback backend URL (`http://localhost:8000`)

## Local Setup

### 1. Database
Execute `supabase_schema.sql` (and `supabase_migration_v2.sql`, `supabase_migration_v3.sql` if upgrading an existing instance) inside the Supabase SQL Editor to initialize tables, indexes, and RLS.

### 2. Backend
```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\activate | macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Deployment

### Backend (Render)
1. Connect repository to Render as an Infrastructure Blueprint using `render.yaml`.
2. Fill required secrets (`SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`, `CORS_ORIGINS` / `ALLOW_ORIGINS`) in dashboard.

### Frontend (Vercel)
1. Import repository in Vercel with Root Directory set to `frontend`.
2. Set Environment Variable `VITE_API_URL` to your production backend URL (e.g. `https://your-backend.onrender.com`).
3. Deploy (SPA route fallback pre-configured in `vercel.json`).
