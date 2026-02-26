# AI Lead Qualifier — Agenzia Immobiliare

MVP per la qualificazione automatica di lead immobiliari (buyer/seller) tramite flusso chat guidato, con scoring deterministico e integrazione webhook.

## Stack

- **Frontend/Backend**: Next.js 16 (App Router) + TypeScript strict + Tailwind CSS
- **Database**: SQLite via Prisma 6 (sostituibile con Postgres per produzione)
- **AI**: Claude `claude-sonnet-4-6` (opzionale — per estrazione zona)
- **Auth admin**: Cookie JWT (jose)
- **Integrazione**: Webhook POST JSON configurabile

---

## Setup rapido

### 1. Copia e compila le variabili d'ambiente

```bash
cp .env.example .env.local
```

Modifica `.env.local`. **Importante per SQLite**: usa il path assoluto:

```env
DATABASE_URL="file:/path/assoluto/al/progetto/dev.db"
ADMIN_PASSWORD="la-tua-password-admin"
JWT_SECRET="stringa-random-32-char-minimo"
```

### 2. Installa dipendenze

```bash
npm install
```

### 3. Inizializza il database

```bash
npx prisma migrate dev --name init
```

### 4. Avvia in sviluppo

```bash
npm run dev   # → http://localhost:3000
```

---

## Test end-to-end

### Flusso buyer CALDO
1. `http://localhost:3000` → "Voglio Comprare"
2. Zona: "Milano Navigli", Tipologia: Appartamento, Budget: 200-300k, Tempistiche: 1-3 mesi, Mutuo: Approvato
3. Verifica: score = **CALDO**, completezza = **100%**

### Flusso seller TIEPIDO
- Zona, Tipologia, Metratura, Stato: Buono, Tempistiche: 6-12 mesi → **TIEPIDO**

### Test FREDDO
- Buyer con "Sto solo raccogliendo informazioni" → **FREDDO**

### Admin dashboard
```bash
# Login
curl -c /tmp/c.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}'

# Lista lead
curl -b /tmp/c.txt http://localhost:3000/api/admin/leads

# Export CSV
curl -b /tmp/c.txt http://localhost:3000/api/admin/leads/export -o leads.csv
```
Oppure → `http://localhost:3000/admin/login`

### Test webhook
1. https://webhook.site → copia URL
2. Admin → Impostazioni → incolla URL → Salva → "Testa webhook"
3. Crea lead → payload JSON ricevuto automaticamente

---

## Variabili d'ambiente

| Variabile | Descrizione | Obbligatoria |
|-----------|-------------|--------------|
| `DATABASE_URL` | Path SQLite assoluto o URL Postgres | ✅ |
| `ADMIN_PASSWORD` | Password admin (testo o hash bcrypt) | ✅ |
| `JWT_SECRET` | Secret sessioni (min 32 char) | ✅ |
| `IP_SALT` | Salt per hash IP | Raccomandata |
| `ANTHROPIC_API_KEY` | Chiave API Claude | No (fallback testo raw) |

### Bcrypt password (produzione)
```bash
node -e "require('bcryptjs').hash('tuapassword', 12).then(console.log)"
```

---

## Deploy su Vercel

1. Push su GitHub → Import su Vercel
2. Aggiungi env vars (Vercel dashboard)
3. Database: usa Vercel Postgres o Neon — aggiorna `schema.prisma`:
   ```
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. `npx prisma migrate deploy` per applicare le migrazioni

---

## Hardening (post-MVP)

- **Rate limiting**: max 5 lead/IP/ora (Upstash Redis)
- **Spam**: honeypot field + Cloudflare Turnstile
- **GDPR**: retention 24 mesi, endpoint anonimizzazione, DPA con hosting provider
- **Audit log**: tabella separata senza PII, log JSON su Axiom/Logtail
- **Backup**: export CSV via Vercel Cron Jobs
- **Future**: Google Sheets, multi-agenzia, email automatiche (Resend), analytics
