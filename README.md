# Vitalis

Your sleep, heart and movement around the clock, from your Fitbit band.

Vitalis reads your Fitbit data through the Google Health API and shows it as one 24-hour dial, a
night-by-night sleep view, an intraday heart chart and trends since you started wearing the band.
A built-in coach answers questions using only your own numbers.

## Features
- **Body clock dial:** sleep stages, workouts and heart rate around the 24-hour day.
- **Sleep:** hypnogram, stage totals and comparisons with your own average.
- **Heart:** 5-minute heart rate, resting rate, HRV, SpO2, breathing rate and skin temperature.
- **Activity:** steps, distance, calories and active zone minutes, from the band only.
- **Coach:** streaming answers about your data, powered by Groq, with key rotation and model fallback.
- **Accounts:** sign in with Google; each person sees only their own data. Sign out or disconnect any time.
- Light, dark and system themes; reduced motion respected.

## Stack
Next.js 16 (App Router), React 19, Tailwind CSS 4, Motion, Supabase (token storage), Groq.

## Setup
1. **Google Cloud:** enable the Google Health API, create an OAuth client (Web application) and add
   `http://localhost:3000/api/auth/callback/google` as an authorised redirect URI.
2. **Supabase:** run `supabase/schema.sql` in the SQL editor.
3. **Environment:** copy `.env.example` to `.env` and fill it in.
4. **Run:**
   ```bash
   npm install
   npm run dev
   ```

## Deploy on Vercel
1. Import the repository in Vercel (or run `vercel`).
2. Add every variable from `.env.example` in Project Settings, Environment Variables. Set
   `NEXTAUTH_URL` to the production address, e.g. `https://vitalis-rhythm.vercel.app`.
3. In Google Cloud, add `<NEXTAUTH_URL>/api/auth/callback/google` as an authorised redirect URI.
4. While the Google OAuth app is in Testing, only listed test users can sign in and their access
   expires after 7 days. Publishing the app (with Google's verification) removes both limits.

## Brand
Logo files and usage rules are in [`brand/`](brand/README.md).

Not a medical device.
