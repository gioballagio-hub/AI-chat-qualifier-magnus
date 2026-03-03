# CLAUDE.md — AI Chat Qualifier Magnus SRL

> Questo file è il contesto completo del progetto. Leggilo sempre prima di fare qualsiasi modifica.
> Aggiornato: marzo 2026

---

## 📌 REGOLE DI LAVORO (OBBLIGATORIE)

1. **Chiedere SEMPRE il permesso prima di fare push**
2. **Prima di ogni modifica: dire cosa si intende fare**
3. **Dopo ogni modifica: dire cosa è stato fatto**
4. **Non toccare mai codice che non è strettamente necessario**
5. **Chiedere sempre il permesso prima di modificare file esistenti**
6. Flusso corretto: spiega → modifica solo il necessario → salva → avvisa → utente testa → ok → chiedi push → commit + push

---

## 🏗️ ARCHITETTURA GENERALE

**Progetto**: AI Lead Qualifier per Magnus SRL (importatore ricambi/accessori auto americani USA: Ford, Dodge, Chevrolet, RAM, Jeep)
**Stack**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Prisma 6 + PostgreSQL
**Deploy**: Vercel — auto-deploy su branch `main` da GitHub (`gioballagio-hub/AI-chat-qualifier-magnus`)
**URL produzione**: `https://gestione.aixum.it`
**DB**: Supabase PostgreSQL
  - Transaction Pooler: porta 6543 (usato da Vercel/Prisma runtime)
  - Direct connection: porta 5432 (solo per migrazioni manuali, NON raggiungibile da Vercel)

**⚠️ IMPORTANTE: Le migrazioni Prisma NON si applicano da Vercel.** Vanno eseguite manualmente via Supabase SQL Editor (porta 5432).
**Build script**: `prisma generate && next build` (NON `prisma migrate deploy`)

---

## 📂 STRUTTURA CARTELLE CHIAVE

```
src/
├── app/
│   ├── api/
│   │   ├── leads/                     # Form web → crea lead
│   │   ├── auth/                      # login, logout, me
│   │   ├── whatsapp/webhook/          # Ricezione messaggi WhatsApp (Meta Cloud API)
│   │   ├── chatwoot-bot/webhook/      # Ricezione eventi bot Chatwoot
│   │   ├── inbound/email/             # Webhook email inbound (Postmark)
│   │   └── admin/
│   │       ├── leads/                 # CRUD lead + export
│   │       │   └── [id]/
│   │       │       ├── route.ts       # GET/PUT/PATCH/DELETE lead
│   │       │       ├── full/          # Lead + Note + ActivityLog + Utenti
│   │       │       ├── note/          # CRUD note
│   │       │       ├── wa-chat/       # Chat WA admin panel (GET/POST/DELETE)
│   │       │       ├── email-history/ # Storico email inviate per lead
│   │       │       └── followup-email/ # Genera/invia email follow-up
│   │       ├── users/                 # Gestione utenti (ADMIN only)
│   │       ├── settings/              # Webhook, reminder, notifiche
│   │       ├── reminders/             # Trigger promemoria automatici
│   │       └── dashboard/             # Analytics
│   ├── admin/
│   │   ├── page.tsx                   # Dashboard lead (lista + filtri + export)
│   │   ├── leads/[id]/page.tsx        # Scheda lead dettaglio
│   │   ├── chatwoot/page.tsx          # Apre Chatwoot in new tab
│   │   ├── impostazioni/page.tsx      # Webhook, reminder
│   │   ├── utenti/page.tsx            # Gestione utenti (ADMIN)
│   │   ├── cestino/page.tsx           # Lead soft-deleted (ADMIN)
│   │   ├── dashboard/page.tsx         # Analytics (ADMIN)
│   │   ├── profilo/page.tsx           # Profilo utente
│   │   └── layout.tsx                 # NAV: Dashboard, WhatsApp (chatwoot), Impostazioni, Utenti, Cestino
│   └── (chat)/                        # Form web chat per clienti
├── components/
│   ├── admin/
│   │   ├── CommunicationsPanel.tsx    # Tab switcher WhatsApp + Email (nella scheda lead)
│   │   ├── WaChatSection.tsx          # Chat WhatsApp (polling 5s, legge da Chatwoot API)
│   │   ├── FollowUpEmailSection.tsx   # Compose email follow-up (integrata in CommunicationsPanel)
│   │   ├── NoteSection.tsx            # Note lead
│   │   ├── ActivitySection.tsx        # Timeline attività
│   │   ├── LeadTable.tsx             # Tabella lista lead
│   │   └── SettingsForm.tsx          # Form impostazioni
│   ├── chat/                          # Componenti form web cliente
│   └── ui/                            # Button, Card, Badge (componenti base)
├── lib/
│   ├── auth.ts         # JWT, sessioni, cookie
│   ├── prisma.ts       # Client Prisma singleton
│   ├── email.ts        # sendCustomerEmail, sendAgencyEmail, sendCommercialEmail, sendReminderEmail
│   ├── scoring.ts      # calcScore, calcNextStep
│   ├── completeness.ts # calcCompleteness
│   ├── activity.ts     # logActivity
│   ├── chatwoot.ts     # sendChatwootMessage, sendPrivateNote
│   ├── integration.ts  # dispatchWebhook
│   ├── ai-extract.ts   # extractLeadFromEmail (Claude Haiku)
│   └── logger.ts       # JSON logger privacy-safe
├── types/
│   ├── lead.ts         # MagnusLeadData, LeadSummary, ContactInfo, tipi principali
│   └── chat.ts         # ChatStep, ChatState, QuestionType
└── constants/
    └── questions.ts    # AZIENDA_STEPS, PRIVATO_STEPS, FIELD_LABELS
```

---

## 🗄️ DATABASE SCHEMA (Prisma)

### Lead (tabella principale)
```
id                  CUID (PK)
clienteType         AZIENDA | PRIVATO | INDEFINITO
nome, cognome       String
emailContatto       String?
telefono            String?
ragioneSociale      String?
brandProdotto       String?
categoriaProdotto   String?          # Ricambi | Accessori | Lubrificanti | Vernici
codiceProdotto      String?
vinCode             String?
data                Json             # MagnusLeadData completo
score               ALTA | MEDIA | BASSA
completeness        Float (0-100)
missingFields       Json (string[])
nextStep            String
status              NEW | CONTACTED | ARCHIVED
statoLead           NUOVO | IN_LAVORAZIONE | OFFERTA_INVIATA | CHIUSO_VINTO | CHIUSO_PERSO
commercialeAssegnato String?
emailInviata        Boolean (default false)
sentToIntegration   Boolean (default false)
consentGiven        Boolean
ipHash              String?
deletedAt           DateTime?        # Soft delete
createdAt, updatedAt DateTime
```

### WaConversation (conversazioni WhatsApp)
```
id                      CUID
phone                   String @unique  # Formato: "393331234567" (senza +)
messages                Json            # Array { role: "user"|"assistant", content: string }[]
raccolto                Json            # Dati parziali raccolti durante chat
completato              Boolean
chatwootConversationId  Int?            # ID conversazione Chatwoot (salvato dal bot webhook)
createdAt, updatedAt    DateTime
```
**⚠️ IMPORTANTE**: `chatwootConversationId` è stato aggiunto con migrazione manuale su Supabase.

### WaMessage (messaggi WhatsApp grezzi)
```
id, phone, text, phoneNumberId, processed, createdAt
```

### User (utenti admin)
```
id, email @unique, nome, passwordHash (bcrypt), ruolo (ADMIN|COMMERCIALE), attivo, createdAt, updatedAt
```

### Nota
```
id, leadId, autore, testo, createdAt
```

### ActivityLog
```
id, leadId, autore, azione (enum), dettagli (Json?), createdAt
Azioni: COMMERCIALE_ASSEGNATO, PIPELINE_AGGIORNATO, NOTA_AGGIUNTA, NOTA_ELIMINATA,
        LEAD_ELIMINATO, LEAD_RIPRISTINATO, WEBHOOK_REINVIATO, STATO_AGGIORNATO,
        LEAD_CREATO_DA_EMAIL, FOLLOWUP_EMAIL_INVIATA, LEAD_MODIFICATO
```

### Settings (singleton id=1)
```
id, integrationMode (WEBHOOK), webhookUrl?, webhookSecret?
notificheEmailCommerciale (bool), reminderAbilitato (bool), reminderGiorni (int)
```

---

## 🔗 INTEGRAZIONI

### 1. Meta WhatsApp Business API
- Numero test: **+15551424985** (test number Meta)
- Phone Number ID: `1025727480621290`
- Business Account ID: `1248420933352614`
- Versione API: v21.0
- **Webhook URL**: `https://gestione.aixum.it/api/whatsapp/webhook`
- **Flusso**: Meta → Chatwoot (inbox) → chatwoot-bot/webhook → WaConversation DB

### 2. Chatwoot (self-hosted su Railway)
- URL: `https://chatwoot-production-7a9b.up.railway.app`
- Account ID: 1
- **Come funziona**:
  - Chatwoot riceve i messaggi WhatsApp da Meta
  - Chatwoot inoltra al bot webhook: `/api/chatwoot-bot/webhook`
  - Il bot processa, risponde tramite `sendChatwootMessage()`
  - Il pannello admin legge i messaggi **direttamente dall'API Chatwoot** (non dal DB)
- **Token**: `CHATWOOT_BOT_ACCESS_TOKEN` (Agent Bot token, permessi limitati)
- **⚠️ PROBLEMA NOTO**: Il BOT_TOKEN potrebbe non avere permessi per leggere messaggi via API. Se il pannello WA non mostra messaggi, potrebbe servire un token utente completo (`CHATWOOT_API_TOKEN`).

### 3. Email (Resend via SMTP)
- Provider: **Resend** (`smtp.resend.com:465`)
- FROM: `info@aixum.it` (dominio Aixum)
- DKIM: già configurato (`resend._domainkey.aixum.it` su Register.it)
- SPF: `v=spf1 mx include:spf.resend.com ~all` (aggiunto su Register.it)
- Gestione DNS: **Register.it** (dominio `aixum.it`)
- ⚠️ Email ancora in spam — DMARC non configurato

### 4. Postmark (email inbound)
- Webhook: `POST /api/inbound/email?secret=POSTMARK_WEBHOOK_SECRET`
- Estrae lead da email con Claude Haiku
- `consentGiven: false` per lead da email

### 5. Claude AI (Anthropic)
- **WhatsApp bot**: Claude Opus 4.6 — raccoglie dati lead in conversazione naturale
- **Email inbound**: Claude Haiku — estrae dati lead da email ricevute
- SYSTEM_PROMPT: Operatore Magnus SRL, raccoglie campi uno alla volta

### 6. Vercel Blob
- Storage file (libretto veicolo)
- Token: `BLOB_READ_WRITE_TOKEN`

---

## 🔑 VARIABILI D'AMBIENTE (Vercel)

| Nome | Descrizione |
|---|---|
| `DATABASE_URL` | Supabase Transaction Pooler (porta 6543) |
| `DIRECT_URL` | Supabase Direct (porta 5432, solo migrazioni) |
| `JWT_SECRET` | Secret per firmare JWT sessioni |
| `IP_SALT` | Salt per hash IP clienti |
| `ADMIN_PASSWORD` | Password admin fallback (retrocompatibilità) |
| `ANTHROPIC_API_KEY` | Claude API key |
| `WHATSAPP_ACCESS_TOKEN` | Meta token (System User, scadenza mai) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID numero WhatsApp Business |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID account Business Meta |
| `WHATSAPP_VERIFY_TOKEN` | Token verifica webhook Meta |
| `CHATWOOT_URL` | URL Chatwoot self-hosted Railway |
| `CHATWOOT_ACCOUNT_ID` | Account ID Chatwoot (= 1) |
| `CHATWOOT_BOT_ACCESS_TOKEN` | Agent Bot token Chatwoot |
| `NEXT_PUBLIC_CHATWOOT_URL` | URL Chatwoot (pubblico, per link frontend) |
| `SMTP_HOST` | smtp.resend.com |
| `SMTP_PORT` | 465 |
| `SMTP_USER` | resend |
| `SMTP_PASS` | API key Resend |
| `SMTP_FROM` | info@aixum.it |
| `AGENCY_EMAIL` | info@aixum.it |
| `NEXT_PUBLIC_BASE_URL` | https://gestione.aixum.it |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token |
| `POSTMARK_WEBHOOK_SECRET` | Secret verifica webhook Postmark |

---

## 👥 UTENTI DEL SISTEMA

| Email | Ruolo | Nome |
|---|---|---|
| operations@magnus-group.it | ADMIN | Giovanni |
| magno.a@magnus-store.it | ADMIN | Andrea |
| giacomo.r@magnus-group.it | COMMERCIALE | Giacomo |
| michael.c@magnus-store.it | COMMERCIALE | Michael |

---

## 🔄 FLUSSI PRINCIPALI

### Form Web Chat
```
Cliente → Chat guidata (AZIENDA_STEPS / PRIVATO_STEPS)
  → POST /api/leads
  → Calcola score + completeness + nextStep
  → Crea Lead DB
  → after(): sendCustomerEmail + sendAgencyEmail + dispatchWebhook
```

### WhatsApp (via Chatwoot)
```
Cliente WhatsApp → Meta Cloud API → Chatwoot (inbox)
  → POST /api/chatwoot-bot/webhook (Agent Bot)
  → Carica WaConversation (phone, senza +)
  → Se completato → silenzio
  → Aggiunge messaggio a history → Claude Opus 4.6
  → Se <LEAD_DATA> in risposta:
      → createLeadFromWA() → Lead DB + sendAgencyEmail()
      → WaConversation.completato = true + chatwootConversationId
      → sendPrivateNote() con riepilogo lead
  → Altrimenti → salva history + chatwootConversationId + risponde
  → sendChatwootMessage() per risposta cliente
```

### Email Inbound (Postmark)
```
Email cliente → MX Magnus → Postmark
  → POST /api/inbound/email?secret=...
  → Claude Haiku estrae dati
  → Se rilevante → Crea Lead (consentGiven: false)
```

### Pannello Admin — Chat WA
```
GET /api/admin/leads/[id]/wa-chat
  1. Legge lead.telefono → phone (senza +)
  2. Cerca WaConversation in DB → chatwootConversationId
  3. Se ID non trovato → cerca su Chatwoot API (contact search)
  4. Se trovato → fetchChatwootMessages() direttamente da Chatwoot API
  5. Fallback → messaggi DB WaConversation
  → Restituisce: messages, hasPhone, completato

POST /api/admin/leads/[id]/wa-chat → invia via Chatwoot API
DELETE /api/admin/leads/[id]/wa-chat → reset WaConversation + toggle_status Chatwoot
```

---

## 📊 LOGICA SCORING

```
ALTA:  Azienda + (codiceProdotto OR vinCode)
       Azienda + descrizione > 20 caratteri
MEDIA: Azienda senza dettagli
       Privato + descrizione > 20 caratteri
BASSA: Default (privato generico)
```

---

## 🧩 COMPONENTE COMUNICAZIONI (scheda lead)

`CommunicationsPanel` — tab switcher con:
- **Tab 💬 WhatsApp**: `WaChatSection` (polling 5s, legge da Chatwoot API direttamente)
  - Mostra empty state se nessun messaggio
  - Pulsante 🔄 Reset (cancella WaConversation + riapre Chatwoot)
  - Auto-scroll solo su nuovi messaggi
- **Tab 📧 Email**: storico email (`ActivityLog` con azione `FOLLOWUP_EMAIL_INVIATA`) + compose
  - Storico: data, oggetto, destinatario
  - Compose: genera bozza AI + edita + invia via `/api/admin/leads/[id]/followup-email`

Visibile solo se `lead.telefono OR lead.emailContatto` è valorizzato.
Default tab: WhatsApp se ha telefono, Email altrimenti.

---

## ⚠️ PROBLEMI NOTI / STATO ATTUALE

### Chat WhatsApp pannello admin
- **Stato**: la route GET ora legge direttamente da Chatwoot API (non dal DB)
- **Possibile problema**: `CHATWOOT_BOT_ACCESS_TOKEN` potrebbe non avere permessi per `GET /conversations/{id}/messages` e `GET /contacts/search` → se il pannello mostra ancora niente, aggiungere `CHATWOOT_API_TOKEN` (token utente con permessi completi da Chatwoot profilo → Access Token)
- **MAGNUS RESET da WhatsApp**: funziona solo se Chatwoot inoltra i messaggi al bot webhook. Dopo un reset, il bot deve ricevere almeno un nuovo messaggio per ricominciare.

### Email spam
- SPF aggiunto su Register.it ✅
- DKIM Resend configurato ✅
- DMARC: non ancora configurato → aggiungere `_dmarc TXT v=DMARC1; p=none; rua=mailto:info@aixum.it`
- Potrebbe ancora andare in spam per reputazione del dominio

### Migrazioni DB
- Supabase porta 5432 NON raggiungibile da Vercel
- Ogni migrazione va applicata manualmente su Supabase SQL Editor
- Build script: `prisma generate && next build` (senza migrate deploy)

---

## 🛠️ COMANDI UTILI (LOCALE)

```bash
# Avvia server locale
npm run dev

# Rigenera tipi Prisma (dopo modifica schema)
npx prisma generate

# Applica migrazione (solo in locale con DB diretto)
npx prisma migrate dev --name nome_migrazione

# TypeScript check
npx tsc --noEmit
```

---

## 📝 CONVENZIONI CODICE

- **Route API params**: `{ params }: { params: Promise<{ id: string }> }` + `const { id } = await params`
- **Auth check**: `const session = await getSessionFromCookies()` su ogni route admin
- **Activity log**: sempre in try-catch, non blocca flusso
- **Email**: dopo-risposta con `after()` di Next.js per non bloccare
- **Phone format**: WhatsApp usa "393331234567" (senza +), lead.telefono usa "+393331234567"
- **Soft delete**: `deletedAt` nullable, query filtrano `where: { deletedAt: null }`
- **Prisma upsert WaConversation**: `where: { phone }` — phone è @unique

---

## 🚀 DEPLOY

```bash
# Push su main → Vercel auto-deploya
git add [files]
git commit -m "descrizione"
git push origin main
```

**⚠️ Chiedere SEMPRE il permesso prima di pushare.**
