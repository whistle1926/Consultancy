# AI Consultancy — Paddy Farren

Live AI consultancy booking page with Fire.com payment verification via Supabase.

## Stack
- **Frontend**: Single HTML file (`index.html`) — host anywhere (GitHub Pages, Netlify, etc.)
- **Backend**: Supabase Edge Function (`supabase/functions/fire-webhook/`)
- **Database**: Supabase Postgres (`payments` table)
- **Payments**: Fire.com Open Banking

## How it works
1. Customer pays via Fire.com payment link
2. Fire sends a signed JWT webhook to the Supabase Edge Function
3. Function verifies the signature & stores payment in the `payments` table
4. Customer enters their email on the page → verified against Supabase → Zoom link unlocks

## Repo Structure
```
├── index.html                              # The website
├── supabase/
│   ├── config.toml                         # Supabase project config
│   ├── functions/
│   │   └── fire-webhook/
│   │       └── index.ts                    # Edge Function (Fire webhook receiver)
│   └── migrations/
│       └── 001_create_payments.sql         # Database schema
└── README.md
```

## Setup

### 1. Run the SQL migration
Supabase → SQL Editor → paste `supabase/migrations/001_create_payments.sql` → Run

### 2. Connect GitHub to Supabase
Supabase → Project Settings → Integrations → GitHub
Select this repo — Edge Functions deploy automatically on push.

### 3. Set Edge Function secrets
Supabase → Project Settings → Edge Functions → Secrets:
```
FIRE_WEBHOOK_SECRET = your_fire_webhook_secret
SUPABASE_URL = https://ocsiqateijkxsalwsiip.supabase.co
SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
```

### 4. Add webhook in Fire
Fire → Settings → API → Add New Webhook:
`https://ocsiqateijkxsalwsiip.supabase.co/functions/v1/fire-webhook`
Events: `PAYMENT_REQUEST_PAYMENT_AUTHORISED`, `LODGEMENT`

### 5. Host index.html
Options (all free):
- **GitHub Pages**: Repo Settings → Pages → Deploy from main branch
- **Netlify**: Drag & drop the `index.html`
- **Any web host**: Upload `index.html`

## Admin Panel
Open your page → click **⚙ Admin** → default password: `admin123`
Change the password immediately in Admin → Settings.

## Test a payment
Run in Supabase SQL Editor:
```sql
INSERT INTO payments (fire_ref, name, email, amount, currency, status)
VALUES ('test-001', 'Test User', 'test@example.com', 60, 'GBP', 'confirmed');
```
Then enter `test@example.com` on the page to verify it works.
