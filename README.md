# NEXUS — The Living Universe

A Vite frontend for the supplied Supabase NEXUS backend.

## Run locally
1. Install Node.js 20+.
2. Extract this folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local URL printed by Vite.
6. Enter the Supabase **Project URL** (base URL, without `/rest/v1/`) and **Publishable key**.

## Deploy (free tiers)
- Vercel: import the folder/repository, framework preset Vite, build `npm run build`, output `dist`.
- Netlify: build `npm run build`, publish `dist`.
- Cloudflare Pages: build `npm run build`, output `dist`.

No secret/service_role key belongs in this frontend. The publishable key is intended for browser use; the SQL schema's RLS and RPC authorization remain essential.

## Included
- Live public universe view and counters
- Public star/galaxy details and replies
- Create stars and replies
- Private planets with passcode unlock and private notes/replies
- Owner token management and JSON export/import
- Star archive, reply moderation, reporting
- Arabic/English interface toggle, automatic initial language from browser locale
- Responsive animated starfield canvas

## Backend contract / known limitations
This UI uses the supplied `nexus-api.js` and SQL RPCs. The supplied backend README explicitly says that audio and a dedicated admin panel are not built. This frontend does not invent an admin/service-role surface. Planet private content is fetched on demand; it is not broadcast over Realtime. Lost owner/author tokens cannot be recovered.

Before public launch, verify RLS, the `supabase_realtime` publication, and all RPC execute grants. The schema's listed `GRANT EXECUTE` block may need to include any RPC the client invokes that is not currently granted (for example `revoke_planet_access`), otherwise the browser will correctly receive a permission error.
