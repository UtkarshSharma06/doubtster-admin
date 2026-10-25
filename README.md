# Doubtster Admin (Next.js) v3

The Doubtster admin panel built as a Next.js 15 app (App Router, TypeScript). Every change goes through server API routes that check the admin's session and write to an audit log.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in the four values
npm run dev                  # http://localhost:3001/admin/login
npm test                     # 19 tests: college rules, 2FA codes, passwords, roles, IP rules
```

Production: `npm run build && npm start`.

## Pages

| Route | What it does |
|---|---|
| `/admin` | Overview, top colleges, latest admin activity, blog health |
| `/admin/analytics` | MRR, ARR, ARPU, DAU/WAU/MAU, funnel, retention, credits, video cost, breakdowns, tracking plan |
| `/admin/colleges` | Add, pause, reactivate and delete college domains. Set credits, expiry, cap, promo code and dates. Test an email. Simulate a signup. Bulk credits. History per college |
| `/admin/users` | Filter by plan, college, country and source. Edit plan, credits and status. Manual grant. CSV export |
| `/admin/payments` | Failed verifications, manual grants, revoke |
| `/admin/videos` | Video job queue: retry and cancel |
| `/admin/controls` | Features, limits and prices (USD), served publicly at `/api/config` |
| `/admin/blog` | Posts list and full SEO editor with autosave. A slug change on a live post adds a 301 |
| `/admin/seo` | sitemap.xml, robots.txt with AI crawler toggles, llms.txt, RSS, IndexNow, redirects |
| `/admin/audit` | Every change: who, when, what. Cannot be edited. CSV export |
| `/admin/settings` | Site details. Backup, import and reset are super admin only |
| `/admin/admins` | Super admin: invite, roles, custom permissions, turn off, reset links, reset 2FA, unlock, sign out, IP allowlist, security rules |
| `/admin/account` | Everyone: name, password, two-step sign in, recovery codes, own devices |
| `/admin/login` | Admin-only sign in with a second step for two-step sign in |

## Admin accounts and roles

**First sign in.** When there are no admins yet, signing in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your env makes that account the **super admin**. After that, the env password is not used again.

**Inviting someone.** Admins and access → Invite admin → pick a role. You get a one-time link (it lasts 48 hours by default). Send it yourself, for example on WhatsApp. They open it and choose their own password. Nothing is emailed automatically.

**Giving an app user admin access.** Users → open the user → Give admin panel access. This creates a separate admin login for their email. Their student account does not change.

**Roles:**

| Role | Can do |
|---|---|
| Super admin | Everything, plus managing admins, sign-in security and data backups |
| Admin | Edit every section. Settings is view only |
| Support | Edit users and payments, view the rest |
| Content | Blog and SEO, plus view Overview and Analytics |
| Growth | Colleges and Analytics, plus view Users and Controls |
| Viewer | Look at everything, change nothing, download nothing |
| Custom | You pick none, view or edit for each section |

**How permissions are enforced:**

- **Every API route checks permissions on the server,** so hiding a button is never the only protection.
- **View-only pages** show a yellow notice, and their save calls are refused.
- **Exporting a CSV** needs edit access on that section.

**Safety rules:**

- You cannot change your own role, turn yourself off, or remove the last active super admin.
- Turning someone off signs them out at once.

## Sign in security

**Passwords:**

- Hashed with scrypt.
- Must be at least 12 characters.
- Common words like "password" or "doubtster" are rejected.

**Two-step sign in:**

- Codes come from Google Authenticator, 1Password, Authy or Microsoft Authenticator.
- Setup uses a QR code.
- You get 8 one-time recovery codes.
- A super admin can **require it for everyone**. Until someone sets it up, they can only open My account.

**Sessions:**

- Each session is stored on the server, so signing someone out works instantly.
- Sessions last 8 hours by default.
- You are signed out after 60 idle minutes by default.
- Every admin can see and end their own devices. A super admin can see and end everyone's.

**Lockout:**

- An account locks for 15 minutes after 5 wrong passwords or codes.
- Each network is also limited to 10 sign-in tries per 15 minutes.

**IP allowlist:** you can limit the panel to an office or VPN. It applies to everyone except super admins, so you cannot lock yourself out.

**Audit log:** every sign in, lock, invite, role change and settings change is logged with the IP address.

**Other protections:**

- Writes are only accepted from your own site (CSRF protection).
- Cookies are httpOnly and SameSite=Strict.
- Every page sends security headers and is marked noindex.
- Backups never include password hashes, 2FA secrets or sessions.

**Locked out completely?** On the server run:

```bash
npm run admin:reset -- you@doubtster.com "a new long password"
```

This sets a new password, turns two-step sign in off, makes the account a super admin and signs out every device. It needs shell access to the server, so it cannot be used from the web.

## App controls

App controls has 10 tabs:

| Tab | What it covers |
|---|---|
| Features | Core features; chat extras (graphs, step mode, follow-ups, sharing, question length, how long history is kept); attachments (photos, PDFs, documents, reading text from photos, size and count limits); languages and subjects |
| Limits and credits | Trial; free chat per day; credits per video; rollover; top-ups; referral credits; video length, daily caps, queue priority, resolution, watermark, music, captions; minimum age; verify email before chatting |
| AI models | Which provider does chat, video scripts and notes; second-opinion check; fallback on errors; creativity and answer length; monthly AI budget with a warning level and what happens when it runs out |
| Pricing and promo codes | Every price in USD; **promo codes** for credits, percent off or extra trial days, with use limits, dates and a new-accounts-only option |
| Regions and safety | Which regions can sign up; academic integrity mode; content filter level; blocked words |
| Announcements | Banner with style, link, audience and start/end times; maintenance message |
| Notifications | Welcome email, trial ending, low credits, weekly summary, come-back email |
| Gradual rollout | Turn new features on for 0 to 100% of students |
| Emergency | One switch each, saved after a second click: stop all video, pause checkout, pause free credits and codes, read-only mode, maintenance mode. A red bar shows on every admin page while any is on |
| History | Every save, with **one-click undo** |

`/api/config` only gives the student app safe fields. It never includes providers, budgets, the blocked words list or keys.

The app checks promo codes with `POST /api/hooks/promo` and `{ code, userKey, isNewUser?, plan?, dryRun? }`.

## College credits: wire them into your signup

All of the rules live in `lib/college.ts`. The admin "Test an email" box and the hooks below call the same code.

Your signup backend calls these with `Authorization: Bearer <HOOK_SECRET>`:

| Hook | When to call it | Body |
|---|---|---|
| `POST /api/hooks/signup` | Right after the account is created | `{ email, name?, verified?, code?, country?, source?, device?, lang? }` |
| `POST /api/hooks/email-verified` | When the student verifies their email | `{ email }` |
| `POST /api/hooks/expire-credits` | Once a day, from a cron job | `{}` |

The signup hook returns `{ credits, collegeCredits, held, reason }`. These rules apply:

- **Matching:** the longest domain wins. Subdomains count only when that option is on, so `fakeupes.ac.in` never matches `upes.ac.in`.
- **When college credits are not given:**
  - the domain is paused
  - the campaign is outside its dates
  - the college has reached its cap
  - the college needs a promo code and it is missing or wrong
- **Unverified email:** the credits are held, then released by the email-verified hook. If the college was paused in the meantime, the held credits are dropped.
- **One college grant per email, ever.** The email is stored as a hash, so deleting and recreating an account does not get the credits again.
- **Blocked domains:** gmail, outlook and other public domains cannot be added as colleges. Throwaway email domains are blocked at signup.
- **The cap holds under load:** changes run one after another, and the tests check that 10 signups at the same moment against 1 free slot give exactly 1 grant.

## Before going live

1. **Database:** `lib/store.ts` keeps everything in one JSON file. That's fine on one server with a disk (Oracle VM, Railway with a volume), but it **does not persist on Vercel**.
   - Replace `read()` and `tx()` with Postgres or Supabase. Keep a transaction and a row lock on the college row, so the cap check stays correct.
2. **Real data:** point the users, payments and video jobs at your app's real tables. Numbers marked "sample" are placeholders.
3. **Rate limiter:** the built-in rate limiter only works on one server. Use Upstash or Redis if you run more than one.
4. **Users list size:** the Users page loads every user. Once you pass about 5,000 users, move the filtering to the server with pagination (`/api/admin/users/export` already filters on the server).
5. **Admin accounts and sessions** are stored in the same data file. Move them to your database together with everything else.

## Prompt for Antigravity

> Add the `doubtster-admin` project as a separate Next.js app or merge it under `/admin` of the main app.
>
> 1. Replace `lib/store.ts` with our database. Keep the function names `read()` and `tx()`. Make `tx()` a real DB transaction, and lock the college row while checking the cap.
> 2. In our signup handler, call `registerSignup()` from `lib/service.ts`, or POST `/api/hooks/signup` with HOOK_SECRET. Add the returned credits to the user.
> 3. In email verification, call `markEmailVerified()`.
> 4. Add a daily cron for `expireCredits()`.
> 5. Point users, payments and video jobs at our real tables.
> 6. Read features and prices from `/api/config` in the student app. Checkout must use server-side prices only.
> 7. Do not change the UI.
> 8. Run `npm test` and keep all tests passing.
