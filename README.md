# Qirlpl LIMS (Web)

React + TypeScript + Vite frontend for Qirlpl LIMS, connected to Supabase.

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (URL + anon key)
- GitHub account
- Vercel account

## Local Setup

1. Install dependencies:

   `npm install`

2. Create env file from template:

   `copy .env.example .env`

3. Add your Supabase values in `.env`:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

4. Run locally:

   `npm run dev`

## Supabase Connection

- Client is configured in `src/lib/supabaseClient.ts`.
- Supabase CLI config exists at `supabase/config.toml`.
- Migrations live in `supabase/migrations`.

Useful commands:

- `npx supabase login`
- `npx supabase link --project-ref <your-project-ref>`
- `npx supabase db push`

## GitHub Connection

From repo root, initialize and connect remote:

1. `git init`
2. `git add .`
3. `git commit -m "Initial project setup"`
4. Create an empty GitHub repo, then:
5. `git remote add origin https://github.com/<your-user>/<your-repo>.git`
6. `git branch -M main`
7. `git push -u origin main`

## Vercel Connection

From `web` directory:

1. `npx vercel login`
2. `npx vercel link`
3. Add production env vars in Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy:
   - `npx vercel --prod`

## Notes

- Never commit `.env` files.
- Only the public Supabase anon key should be used in frontend.
- For DB changes, add SQL files under `supabase/migrations`.
