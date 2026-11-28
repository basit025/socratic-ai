# Socratic AI: Setup Guide (Supabase, API keys, Vercel, teammates)

Follow this file from top to bottom in one sitting (about 75 minutes). When you reach the end, send Claude the short report in **Step 9**. You don't need to come back to the chat in between.

**Already done:** GitHub repo (`basit025/socratic-ai`), the Vercel project, and Step 1 (live at `https://socratic-ai-pk.vercel.app`).

**Before you start**

- Open a password manager (Bitwarden is free) or a private note that only you can see. Every key and password below goes there.
- **Never** paste keys into WhatsApp, a group chat, an email, GitHub or the code.
- **"The terminal"** in this guide means the normal Ubuntu Terminal app, **not** the Claude Code chat. Open it with **Ctrl + Alt + T** (or the Activities menu → type "Terminal" → Enter). Then go to the project folder:

  ```bash
  cd ~/Desktop/socratic-ai
  ```

  To run a command: copy it from this guide, paste it into the terminal with **Ctrl + Shift + V**, and press **Enter**. To copy a result: select it with the mouse, then press **Ctrl + Shift + C**.
- Don't run password or key commands in the Claude Code chat (for example with `!`). Anything typed there becomes part of the conversation, and secrets should stay on your computer only.

| Step | What | Time | Protects |
| --- | --- | --- | --- |
| 1 | Clean live URL | 3 min | Presentation |
| 2 | Two Supabase databases in South Asia | 15 min | Technical Execution |
| 3 | Plan the AI keys (who provides which) | 3 min | Technical Execution |
| 4 | Create Gemini, Groq and OpenRouter keys (+ paid credit) | 15 min | Technical Execution |
| 5 | Cron secret | 1 min | Technical Execution |
| 6 | Paste everything into Vercel | 10 min | Technical Execution |
| 7 | Check that everything works | 5 min | Technical Execution, Presentation |
| 8 | Add teammates on GitHub | 5 min | Technical Execution |
| 9 | Report to Claude | 1 min | |

---

## Step 1: Claim a clean live URL in **Vercel** (done)

The production URL is **https://socratic-ai-pk.vercel.app**. It is the only URL used in the README, on GitHub, in the video and in the deck. The temporary `-rho` address Vercel generated has been removed.

---

## Step 2: Create two Supabase databases in South Asia (15 min)

*Why: our server runs in South Asia. The database must be in the same region, or every page waits on South Asia↔Tokyo round-trips. Two projects keep testing away from the demo data judges see.*

You need two projects, both in **South Asia (ap-south-1)**:

| Project name | Used by |
| --- | --- |
| `socratic-ai-prod` | The live site judges see (Production) |
| `socratic-ai-preview` | Pull-request previews and teammates' local work (Preview) |

### 2.1 Delete the Tokyo project

1. Go to **supabase.com/dashboard** and open the project that was created in Tokyo.
2. Click the **gear icon (Project Settings)** at the bottom of the left menu → **General**.
3. Scroll to the bottom → **Delete project** → type the project's name → confirm.
4. Wait about a minute until it disappears from the project list. (The free plan allows 2 active projects, so the Tokyo one must be gone first.)

### 2.2 Make two database passwords

In the terminal, run this **twice** and save each result in your password manager, labelled "Supabase prod DB password" and "Supabase preview DB password":

```bash
openssl rand -hex 20
```

(Hex passwords have no special characters, so they never break a terminal command.)

### 2.3 Create the projects: try the dashboard first

1. In the dashboard, click **New project**.
2. Look at the **Region** field. Besides "Americas / Europe / Asia-Pacific", look for a link, toggle or dropdown such as **"Specific region"**, **"Advanced"** or a list of cities.
3. **If you can pick "South Asia" / `ap-south-1`:**
   - Name: `socratic-ai-prod`, Database password: the prod password from 2.2, Region: **South Asia**, Plan: Free → **Create new project**.
   - Repeat with name `socratic-ai-preview` and the preview password, also **South Asia**.
   - Skip 2.4 and go to **2.5**.
4. **If you can only pick the broad groups, don't create anything.** Close the form and use 2.4.

### 2.4 Create the projects with the command line (reliable way to get South Asia)

1. Log in (a browser window opens; click **Authorize**):

   ```bash
   npx supabase login
   ```

   If it asks to install the `supabase` package, type `y`.

2. Find your organization ID:

   ```bash
   npx supabase orgs list
   ```

   Copy the value in the **ID** column (a string of letters, for example `abcdefghijklmnop`).

3. Create the production project. Replace `ORG_ID` and `PROD_PASSWORD`:

   ```bash
   npx supabase projects create socratic-ai-prod --org-id ORG_ID --db-password PROD_PASSWORD --region ap-south-1
   ```

4. Create the preview project. Replace `ORG_ID` and `PREVIEW_PASSWORD`:

   ```bash
   npx supabase projects create socratic-ai-preview --org-id ORG_ID --db-password PREVIEW_PASSWORD --region ap-south-1
   ```

   If it asks about plan or size, choose the **free** / smallest option.

5. Check both projects and their region:

   ```bash
   npx supabase projects list
   ```

   Both rows must show **REGION = `ap-south-1`**. Copy each project's **REFERENCE ID** (about 20 letters). Wait 2 minutes for the projects to finish starting.

### 2.5 Copy the keys for each project

Do this for **socratic-ai-prod**, then again for **socratic-ai-preview**.

**Dashboard way:**

1. Open the project → **Project Settings (gear)** → **API** or **API Keys**.
2. Copy the **Project URL**. It looks like `https://abcdefghijklmnopqrst.supabase.co`.
3. Copy the **anon / public** key (a long string starting with `eyJ`).
4. Copy the **service_role** key (also starts with `eyJ`). **This one is secret.** It gives full access to the database.
5. If you only see keys called "publishable" and "secret" (starting with `sb_`), click the **Legacy API keys** tab and copy **anon** and **service_role** from there. Our code expects the `eyJ...` keys.

**Command-line way (if you used 2.4):**

```bash
npx supabase projects api-keys --project-ref REFERENCE_ID
```

This prints the `anon` and `service_role` keys. The Project URL is `https://REFERENCE_ID.supabase.co`.

### 2.6 Confirm the region in the dashboard

Open each project → **Project Settings → General**. The region should say **South Asia** / `ap-south-1`.

> If either project ended up anywhere other than South Asia, still finish the guide, and say so in your Step 9 report. Claude will move the server to the same region (a one-line change).

**Save in your password manager (6 values):**

```
Supabase PROD  URL:          https://....supabase.co
Supabase PROD  anon key:     eyJ...
Supabase PROD  service_role: eyJ...   (secret)
Supabase PREVIEW URL:        https://....supabase.co
Supabase PREVIEW anon key:   eyJ...
Supabase PREVIEW service_role: eyJ... (secret)
```

---

## Step 3: Plan the AI keys: who provides which key (read first, 3 min)

*Why: if Ustaad's AI stops answering in front of a judge, Technical Execution collapses. Three providers in a chain keep it answering.*

### How the live site stays up

The server tries the providers in order. If one is out of quota or down, the next takes over automatically:

**Gemini → Groq → OpenRouter**

That is three different providers, each with its own limits. When Gemini runs out, the site keeps working.

### Who provides which key

| Where it's used | Whose accounts | Gemini | Groq | OpenRouter |
| --- | --- | --- | --- | --- |
| **Production** (the live site judges use) | **You (Basit)** | 1 key | 1 key | 1 key |
| **Preview** (pull-request test links) | **One teammate** (call them Teammate A) | 1 key | 1 key | 1 key |
| **Local development** (each laptop) | **Each teammate, their own** | 1 key each | 1 key each | optional |

Each teammate making keys for their **own** laptop is the right way to use everyone's accounts: each person's testing uses their own free quota, and nobody uses up the demo's quota.

### What **not** to do: don't pool several accounts' keys into one environment

Don't collect keys from several of your accounts (or teammates' accounts) and rotate them on the live site to multiply free quota:

- **Google's API terms forbid getting around quota limits** with extra accounts or projects. Groq's and OpenRouter's terms are similar.
- If a provider spots it, it can **ban the keys or accounts**, possibly during screening week, which would take the demo down.
- The repo is public. A technical judge who sees code rotating personal accounts' keys will mark it down.

**If quota runs short, add a few dollars of paid credit instead** (Step 4.4). It's cheap, allowed, and much more reliable.

---

## Step 4: Create the AI keys (15 min, plus Teammate A's part)

Do 4.1–4.3 yourself for **Production**. Send Teammate A this step so they create the same three keys for **Preview** from their own accounts and give them to you privately (a password manager share or in person, never in a group chat).

### 4.1 Gemini (main model)

1. Go to **aistudio.google.com** and sign in.
2. Click **Get API key** → **Create API key**.
3. When asked for a Google Cloud project, choose **Create new project** (or "Create API key in new project"). If you can name it, use `socratic-ai-prod` (Teammate A uses `socratic-ai-preview`).
4. Copy the key (starts with `AIza`) and save it as **"Gemini PROD key"** (Teammate A: "Gemini PREVIEW key").
5. **Only one key per account** for this project. Making more keys in the same project doesn't add quota: all keys in one project share the same limit.

### 4.2 Groq (backup 1)

1. Go to **console.groq.com** and sign in (Google or GitHub is fine).
2. Left menu → **API Keys** → **Create API Key** → name it `socratic-ai-prod` (Teammate A: `socratic-ai-preview`) → **Submit**.
3. Copy the key (starts with `gsk_`) **immediately**: it's shown only once. Save it as **"Groq PROD key"**.

### 4.3 OpenRouter (backup 2)

**Create the key:**

1. Go to **openrouter.ai** → **Sign in** (Google or GitHub is fine).
2. Open your profile menu → **Keys** (or go to `openrouter.ai/settings/keys`) → **Create Key**.
3. Name it `socratic-ai-prod` (Teammate A: `socratic-ai-preview`).
4. If there is a **Credit limit** field, set it to `5` (US dollars). This caps what the key can ever spend.
5. Click **Create**, copy the key (starts with `sk-or-`) **immediately**, and save it as **"OpenRouter PROD key"**.

**Choose the model** (once, for the whole team):

1. Go to **openrouter.ai/models**.
2. Filter by **Supported parameters → structured_outputs**. Our code needs answers in a fixed JSON format, so only these models work.
3. Pick **one**:
   - **Best:** `google/gemini-3.1-flash-lite` if it's listed. Ustaad's prompts are written for Gemini, and it costs a fraction of a cent per viva. It needs OpenRouter credit (4.4).
   - **Free:** a model whose id ends in `:free`. Free models have small daily limits: about 50 requests a day without credit, and about 1,000 a day after a one-time $10 credit purchase (OpenRouter's numbers as of 2025; check the current figures in OpenRouter's FAQ before relying on them).
4. Copy the model's exact id (the `provider/model-name` text shown under its name) and save it as **"OPENROUTER_MODEL"**. Production and Preview use the same model.

### 4.4 Paid credit (strongly recommended, about $5–10 in total)

*This is the real fix for "Gemini keys run out too fast".*

- **Gemini billing on the production project:** in AI Studio, on the API keys page, click **Set up billing** (or **Upgrade**) next to the `socratic-ai-prod` project and add a card.
  - Then in **console.cloud.google.com → Billing → Budgets & alerts → Create budget**, set **$5** with email alerts at 50%, 90% and 100%.
  - Our estimate (not a measurement): Flash-Lite costs a fraction of a cent per viva, so $5 should cover the whole hackathon. We'll measure the real cost on Thursday.
  - **Bonus:** on the paid tier, Google doesn't use our prompts to improve its products. That matters on Thursday, when real students use the platform (decision D3 in the plan).
- **OpenRouter:** **Credits** (`openrouter.ai/credits`) → **Add credits** → $10. It unlocks the paid model and raises free-model limits.
- **Paying from Pakistan:** most bank debit cards work for international online payments once you **enable "international / online transactions"** in your bank's app. A virtual card from a bank app or SadaPay/NayaPay may also work.

### Save in your password manager

```
Gemini PROD key:        AIza...
Groq PROD key:          gsk_...
OpenRouter PROD key:    sk-or-...
OPENROUTER_MODEL:       provider/model-name
--- from Teammate A ---
Gemini PREVIEW key:     AIza...
Groq PREVIEW key:       gsk_...
OpenRouter PREVIEW key: sk-or-...
```

---

## Step 5: Cron secret (1 min)

*Why: the nightly demo reset runs at 3 AM PKT. The secret makes sure only Vercel can trigger it.*

In the terminal:

```bash
openssl rand -hex 32
```

Copy the 64-character result and save it as **"CRON_SECRET"**.

---

## Step 6: Paste everything into Vercel (10 min)

*Why: keys live only in Vercel, never in the code. Production and Preview get different keys and databases.*

1. Go to **vercel.com** → **socratic-ai** project → **Settings** → **Environment Variables**.
2. For each entry in the table below:
   - Type the **Key** exactly as written (capital letters, underscores).
   - Paste the **Value**. Check there is no space before or after it.
   - Under **Environments**, tick **only** the boxes listed in the last column. Untick the others (Vercel may tick all three by default).
   - **Type:** choose **Secret** for the rows marked 🔒 (API keys, anon and service_role keys, cron secret) and **Config** for the others. (Older Vercel screens show a **Sensitive** switch instead: turn it on for the 🔒 rows.)
   - **Note (optional):** write whose account the key came from, for example "Prod – Basit's Google account".
   - **Scroll down** in the dialog to find the environment checkboxes before saving.
   - Click **Save**.

| # | Key | Value | Tick only |
| --- | --- | --- | --- |
| 1 | `GEMINI_API_KEY` 🔒 | Gemini PROD key | Production |
| 2 | `GEMINI_API_KEY` 🔒 | Gemini PREVIEW key | Preview |
| 3 | `GROQ_API_KEY` 🔒 | Groq PROD key | Production |
| 4 | `GROQ_API_KEY` 🔒 | Groq PREVIEW key | Preview |
| 5 | `OPENROUTER_API_KEY` 🔒 | OpenRouter PROD key | Production |
| 6 | `OPENROUTER_API_KEY` 🔒 | OpenRouter PREVIEW key | Preview |
| 7 | `OPENROUTER_MODEL` | the model id from Step 4.3 | Production **and** Preview |
| 8 | `LLM_PROVIDER` | `gemini` | Production **and** Preview |
| 9 | `SUPABASE_URL` | Supabase PROD URL | Production |
| 10 | `SUPABASE_URL` | Supabase PREVIEW URL | Preview |
| 11 | `SUPABASE_ANON_KEY` 🔒 | Supabase PROD anon key | Production |
| 12 | `SUPABASE_ANON_KEY` 🔒 | Supabase PREVIEW anon key | Preview |
| 13 | `SUPABASE_SERVICE_ROLE_KEY` 🔒 | Supabase PROD service_role | Production |
| 14 | `SUPABASE_SERVICE_ROLE_KEY` 🔒 | Supabase PREVIEW service_role | Preview |
| 15 | `CRON_SECRET` 🔒 | the CRON_SECRET from Step 5 | Production |

That's 15 entries. The same key name appears twice when Production and Preview need different values; that's expected.

3. When all 15 are saved, check the list: each name shows the right environment label next to it.
4. **Redeploy so the new values take effect:**
   - Click **Deployments** (top menu).
   - On the top deployment (marked **Production** / **Current**), click the **⋯** (three dots) → **Redeploy**.
   - In the dialog, leave "Use existing Build Cache" as it is → **Redeploy**.
   - Wait until it shows **Ready** (about 1 minute).

**For local development (every teammate):** create a file `.env.local` in the project folder and copy the lines from `.env.example` into it. Fill in:

- the **PREVIEW** Supabase values (URL, anon key, service_role) and `CRON_SECRET` left empty;
- **your own** Gemini, Groq and (optionally) OpenRouter keys, from your own accounts;
- the same `OPENROUTER_MODEL` as the team.

Never put production keys in `.env.local`. The file is ignored by git, so it's never uploaded.

---

## Step 7: Check that everything works (5 min)

### 7.1 Health check

Open in your browser:

```
https://YOUR-DOMAIN/api/health
```

**Expected:**

```json
{"status":"ok","checks":{"database":"ok","gemini":"ok","groq":"ok","openrouter":"ok"},"llmProvider":"gemini","environment":"production", ...}
```

If something isn't `ok`:

| You see | Meaning | Fix |
| --- | --- | --- |
| `"not_configured"` | Vercel doesn't have that variable for Production | Check the key name spelling and that **Production** is ticked; redeploy |
| `"database":"error"` | Wrong Supabase URL or service_role key, or the project is still starting | Check rows 9 and 13; wait 2 minutes; make sure you used the `eyJ...` service_role key, not the `sb_` one |
| `"gemini":"error"` | Wrong Gemini key | Check row 1; create a new key if needed |
| `"groq":"error"` | Wrong Groq key | Check row 3 |
| `"openrouter":"error"` | Wrong OpenRouter key, or the key's credit limit is used up | Check row 5; check the key on `openrouter.ai/settings/keys` |
| Still old values after fixing | Variables only apply after a redeploy | Redeploy again (Step 6.4) |

Results are cached for 60 seconds, so wait a minute before re-checking.

### 7.2 Cron check

1. In Vercel, open **Settings → Cron Jobs**. You should see `/api/cron/reset-demo` with schedule `0 22 * * *`. (22:00 UTC = 3:00 AM Pakistan time.)
2. Test it from the terminal. Replace `YOUR_CRON_SECRET` and `YOUR-DOMAIN`:

   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-DOMAIN/api/cron/reset-demo
   ```

   **Expected:** `{"ok":true,"database":"ok","sandboxesDeleted":0,...}`

3. Test that it refuses strangers:

   ```bash
   curl https://YOUR-DOMAIN/api/cron/reset-demo
   ```

   **Expected:** `{"error":"Unauthorized."}`

### 7.3 Landing page

Open `https://YOUR-DOMAIN` in a normal browser window **and** on your phone (mobile data, not Wi-Fi). The grey status box should say `Server: ok · database ok · Gemini ok · Groq ok · OpenRouter ok`.

### 7.4 Preview protection (if not done yet)

**Settings → Deployment Protection → Vercel Authentication** → switch **off** → **Save**. This lets teammates open pull-request preview links without a Vercel login.

---

## Step 8: Add teammates on GitHub (5 min)

*Why: everyone pushes branches and opens pull requests; each PR gets its own preview link for testing.*

1. Go to **github.com/basit025/socratic-ai**.
2. Click **Settings** (top right of the repo) → **Collaborators** (left menu). GitHub may ask for your password or 2FA code.
3. Click **Add people** → type a teammate's GitHub username or email → select them → **Add to repository**.
4. Repeat for all four teammates.
5. Each teammate opens the invite email (or github.com/notifications) and clicks **Accept invitation**.
6. Check: Settings → Collaborators shows all four with no "Pending" label.

**Tell teammates the team rules:**

- Never push straight to `main`. Make a branch, push it, open a pull request.
- Test on the PR's preview link (Vercel posts it on the PR), then merge.
- Never commit `.env.local` or any key.
- For local development, everyone creates **their own** Gemini and Groq keys (Step 4.1–4.2, from their own accounts) and puts them in their own `.env.local`. Never share keys, and never use the production keys locally.

---

## Step 9: Report to Claude (copy, fill in, send)

```
Setup done.
1. Live domain: ____________ .vercel.app
2. Supabase region shown for prod: __________   preview: __________
3. /api/health shows: database ___  gemini ___  groq ___  openrouter ___
   OPENROUTER_MODEL chosen: ____________
   Paid credit added: Gemini yes / no   OpenRouter yes / no
4. Cron test with secret: ok / not ok   |   without secret: Unauthorized yes / no
5. Teammates added: (GitHub usernames) ____, ____, ____, ____  (accepted: yes / pending)
6. Anything that didn't match this guide: ____________
```

Don't include any keys or passwords in the report. Claude never needs them.

After this report, Claude updates the README and CLAUDE.md to your final domain and starts Monday's build.
