# Exposure check: setup (about 30 minutes, all free)

The page lives at `vallbruna.com/check/` (this folder). It needs three free services:
**Supabase** (accounts), **Brevo** (sends the sign-in codes) and nothing else. Until step 4 is done,
the page shows "isn't set up yet" online, and runs in demo mode on your own computer.

## 1. Supabase project

1. Sign up at supabase.com, click **New project**. Name: `vallbruna`. Region: **Frankfurt (eu-central-1)**
   (EU data stays in the EU). Save the database password in your password manager.
2. **SQL Editor -> New query**: paste everything from `setup.sql`, click **Run**. (This enables the
   "Delete my account" button.)
3. **Authentication -> Sign In / Providers -> Email**: keep Email enabled. Set **Email OTP length** to 6
   and **expiry** to 1800 seconds (30 minutes).

## 2. Sign-in email shows a code, not a link

**Authentication -> Email Templates**. Change two templates, **Magic Link** and **Confirm signup**,
to show the code. Subject: `Your Vallbruna code: {{ .Token }}`. Body:

```html
<p>Hello,</p>
<p>Your Vallbruna code is:</p>
<p style="font-size:28px;letter-spacing:6px;font-family:monospace"><strong>{{ .Token }}</strong></p>
<p>Type it on the page where you asked to check this address. It expires in 30 minutes.</p>
<p>If this wasn't you, ignore this email and nothing happens.</p>
<p>Vallbruna</p>
```

Why a code: mail scanners in Outlook and company inboxes open links automatically, which would use up a
one-time link before the person clicks it. A code can't be used up that way.

## 3. Brevo sends the emails

Supabase's own email only sends 2 emails an hour, and only to your team. Brevo's free plan sends about
300 a day.

1. Sign up at brevo.com (free plan).
2. **Senders, Domains & Dedicated IPs -> Domains -> Add a domain**: `vallbruna.com`. Brevo shows a few
   DNS records (DKIM, SPF, DMARC). Add them where vallbruna.com's DNS is managed, then click
   **Authenticate**. This keeps the codes out of spam.
3. **SMTP & API -> SMTP**: note the server (`smtp-relay.brevo.com`), port `587`, login, and create an
   **SMTP key**. Paste the key only into Supabase, never into chat or into this repo.
4. Back in Supabase: **Authentication -> Emails -> SMTP Settings -> Enable custom SMTP**:
   sender email `no-reply@vallbruna.com`, sender name `Vallbruna`, host, port 587, username = Brevo login,
   password = the SMTP key. Save.
5. **Authentication -> Rate Limits**: emails per hour, set to 100 (Brevo's daily 300 is the real ceiling).

## 4. Connect the page

**Project Settings -> API** (or **Data API**): copy the **Project URL** and the **anon public** key into
`check/config.js`. Both are designed to be public. Never use the `service_role` key here.

## 5. Publish

Commit and push this repo. GitHub Pages serves the page at `/check/`. Open it, check your own email, and
you should get the code from no-reply@vallbruna.com.

## Where to see your users

Supabase -> **Authentication -> Users**: every confirmed email, with sign-up date. Export: **Table
Editor** or the SQL editor (`select email, created_at from auth.users`).

## Limits to keep in mind

- Brevo free: about 300 emails a day. More people than that per day = a paid Brevo plan (from about $9/month).
- XposedOrNot free: personal, low-volume use, counted per visitor's IP. Before a public launch, ask
  them for a startup licence or take xonAPI+ (from $9/month).
- Supabase free pauses a project after 1 week with no activity. Restart with one click in the dashboard.
- No automatic backups on Supabase free: export the user list now and then.
