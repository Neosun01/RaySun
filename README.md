# Ray · 孙睿 — Personal Homepage

Interaction designer for finance. Print → UI → UX.

- Live: https://ray-sun.vercel.app
- Source of design: Figma

## Stack

Static HTML + CSS. No build step.

- `index.html` — page markup
- `styles.css` — design tokens + responsive layout
- `i18n.js` — EN / 中 strings
- `projects.js` — loads "Selected work" cards from Supabase (falls back to the static cards if not configured)
- `cards.js` — the project card (image carousel, video embed), shared by the site and the admin
- `admin.html` / `admin.js` — private login + list of projects, at `/admin.html`
- `admin-edit.html` / `admin-edit.js` — the create / edit page (own page, not a pop-up): `/admin-edit.html` (new), `/admin-edit.html?id=…` (edit)
- `admin-common.js`, `admin.css` — shared admin code and styles
- `supabase/setup.sql` — database table, image bucket and access rules
- `supabase-config.js` — your Supabase URL + public (anon) key

## Local preview

Open `index.html` in a browser, or serve it:

```sh
python3 -m http.server 5173
# then visit http://localhost:5173
```

## Deploy

Deployed via Vercel from the `main` branch of this repo.

## Projects admin (Supabase) — one-time setup

1. Create a free project at https://supabase.com (any region; pick the one closest to your visitors).
2. **Authentication → Users → Add user**: create *your* account (email + password, tick "Auto Confirm User").
   Then **Authentication → Sign In / Providers → turn OFF "Allow new users to sign up"**.
3. Open `supabase/setup.sql` (safe to run again if you set up an earlier version: it adds the new `images` column). The line `lower('sunrui714142436@gmail.com')` must be the same email as the user from step 2
   (change it if you used another). Paste the whole file into **SQL Editor → New query → Run**.
4. **Project Settings → API**: copy *Project URL* and the *anon public* key into `supabase-config.js`
   (never the `service_role` key). Upload the changed file to GitHub; Vercel redeploys.
5. Open `https://ray-sun.vercel.app/admin.html`, sign in, and add your work.

What visitors can do is enforced by the database rules, not by the page: they can only read rows marked
"published". Only the account in step 3 can create, edit, delete, or upload images.
Each project can have up to 12 images (first = cover, drag to reorder), 10 MB each (JPG / PNG / WebP / GIF / AVIF). Videos are pasted as YouTube / Bilibili / Vimeo
links (or a direct https `.mp4` link).
