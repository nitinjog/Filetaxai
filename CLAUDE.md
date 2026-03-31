# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FileTaxAI** — AI-powered Indian income tax computation and filing assistant for salaried individuals. Supports FY 2024-25 (AY 2025-26). Computes tax under both Old and New regimes, recommends the optimal one, and guides ITR filing.

## Monorepo Structure

```
filetaxai/
├── backend/    Node.js + Express + TypeScript + Prisma + PostgreSQL
└── frontend/   Next.js 14 + TypeScript + Tailwind + shadcn/ui
```

---

## Backend

### Dev Commands
```bash
cd backend
npm install
cp .env.example .env          # fill in secrets
npm run db:generate           # generate Prisma client
npm run db:push               # sync schema to DB (dev)
npm run db:migrate            # production migrations
npm run dev                   # tsx watch (hot reload)
npm run build                 # tsc compile → dist/
npm start                     # run compiled dist/index.js
```

### API Base: `http://localhost:3001/api`

| Route | Purpose |
|-------|---------|
| `/auth` | Register, login, JWT refresh |
| `/sessions` | Tax session CRUD |
| `/upload` | Multer → Cloudinary document upload |
| `/parse` | PDF/OCR parsing + AI extraction |
| `/compute-tax` | Deterministic tax engine |
| `/ai-review` | LLM validation, explanation, suggestions |

### Key Services

- **`src/services/taxEngine.ts`** — The core. All tax math is deterministic here. **Never use LLM for actual computation.** Implements:
  - HRA exemption (3-condition minimum rule)
  - Old Regime: slabs + all 80C/80D/HRA/LTA deductions, age-aware slabs (Senior ≥60, Super-Senior ≥80)
  - New Regime: Budget 2024 slabs, ₹75,000 standard deduction, ₹7L rebate limit
  - Surcharge with marginal relief
  - 87A rebate, 4% Health & Education Cess
  - LTCG/STCG (taxed separately, not mixed into slab income)

- **`src/utils/taxConfig.ts`** — All numeric tax constants for FY 2024-25. **When tax laws change, update only this file.**

- **`src/services/documentParser.ts`** — PDF (pdf-parse) + OCR (tesseract.js) extraction for Form 16, Form 26AS, AIS, Salary Slips. AI is used as fallback for noisy OCR.

- **`src/services/aiService.ts`** — OpenRouter calls. Primary: `openai/gpt-4o`. Fallback: `anthropic/claude-3-7-sonnet`. Use only for: parsing support, explanation, validation.

- **`src/services/storageService.ts`** — Cloudinary v2. Documents auto-deleted after 30 days unless user opts in.

### Database (Prisma)

Schema in `prisma/schema.prisma`:
- `User` → `TaxSession` → `Document` (parsed data stored as JSON column)
- `TaxComputation` (linked to session, stores both regime results as JSON)
- `AuditLog` (IP-tracked user actions)

PAN is always masked (stored as last 4 digits only). Encryption via AES-256-GCM in `src/utils/encryption.ts`.

---

## Frontend

### Dev Commands
```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL
npm run dev                         # Next.js dev server :3000
npm run build                       # production build
npm run lint                        # ESLint
```

### Page Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/login`, `/register` | Auth |
| `/upload` | Document upload + parse trigger |
| `/compute` | Income/deduction form (pre-filled from parsed docs) |
| `/results` | **Main output**: regime comparison, charts, breakdown |
| `/filing-guide` | Step-by-step ITR portal guide |
| `/sessions` | History |
| `/profile` | Settings |

### State Architecture

- **`store/authStore.ts`** (Zustand, persisted to localStorage) — user, JWT token, isAuthenticated
- **`store/taxStore.ts`** (Zustand, session storage) — current session, documents, incomeData, computationResult
- **`hooks/useTaxComputation.ts`** — React Query wrappers for all API calls

### Important Conventions

- All currency displayed in ₹ using `en-IN` locale. Use the `formatINR()` helper in `lib/utils.ts`.
- Use `lib/api.ts` for all HTTP calls — it handles JWT injection and 401 refresh.
- `lib/types.ts` mirrors backend types exactly. Keep these in sync when changing API contracts.
- shadcn/ui components live in `components/ui/`. Do not modify them directly; extend via composition.

---

## Tax Law Reference (FY 2024-25)

| | Old Regime | New Regime |
|--|-----------|-----------|
| Standard Deduction | ₹50,000 | ₹75,000 (Budget 2024) |
| 87A Rebate limit | ₹5,00,000 | ₹7,00,000 (Budget 2024) |
| 87A Rebate amount | ₹12,500 | ₹25,000 |
| Key deductions | 80C (₹1.5L), 80D, HRA, LTA | Only 80CCD(2) employer NPS |
| Surcharge cap (LTCG) | 15% | 15% |

When tax year changes, update **only** `backend/src/utils/taxConfig.ts`.

---

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL            PostgreSQL connection string
JWT_SECRET              Min 32 chars
OPENROUTER_API_KEY      sk-or-v1-...
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
ENCRYPTION_KEY          32-char hex
PORT                    3001
FRONTEND_URL            http://localhost:3000
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL     http://localhost:3001
NEXT_PUBLIC_APP_NAME    FileTaxAI
NEXT_PUBLIC_TAX_YEAR    2024-25
```

---

## Deployment

### Frontend → Netlify
- Build: `npm run build` in `frontend/`
- Publish dir: `frontend/.next`
- Plugin: `@netlify/plugin-nextjs`
- Config: `frontend/netlify.toml`

### Backend → Render
- Config: `backend/render.yaml`
- Render auto-provisions PostgreSQL, injects `DATABASE_URL`
- Start command runs `prisma migrate deploy` before `node dist/index.js`

---

## Test Cases (Tax Engine)

| Scenario | Expected behaviour |
|----------|-------------------|
| Salary ₹5L, no deductions | New regime better (zero tax after 87A rebate) |
| Salary ₹10L, max 80C | Old regime likely better |
| Salary ₹20L, HRA metro + 80C + 80D | Compare manually; old regime usually better |
| Age ≥ 60 | Old regime uses senior citizen slabs (₹3L zero slab) |
| Income > ₹50L | Surcharge at 10% kicks in; verify marginal relief |

Run engine directly: `src/services/taxEngine.ts` exports `compareTaxRegimes(incomeData)`.

---

## Known Gotchas & Architecture Notes

### Data Flow
- `GET /api/documents` and `GET /api/documents/session/:sessionId` must include `parsed_data: true` in Prisma select — omitting it silently breaks the compute page pre-fill
- `POST /api/compute/manual` accepts either flat snake_case **or** nested camelCase `{income:{grossSalary}, deductions:{section80C}}` — mapping block in the route handles both
- `POST /api/compute/manual` upserts on `sessionId` from request body — never creates a new session if one is provided
- AI review routes (`/api/ai-review/:id/*`) accept either a `computationId` or a `sessionId` in the URL — `loadComputation` tries `session_id` lookup first

### Frontend State
- `authStore.login()` and `authStore.logout()` both call `useTaxStore.getState().clearSession()` — required to prevent cross-user data leakage
- `useParseDocuments.onSuccess` must NOT call `setDocuments()` — parse session response returns status objects, not documents; use query invalidation instead
- `react-hook-form` on the compute page uses `useEffect` + `reset()` keyed on `parsedDoc?.id` because async data arrives after mount

### Document Parsers
- `parseForm26AS` and `parseAIS` accept a `mimeType` parameter — always pass it from `parse.ts` to enable Tesseract OCR for PNG/JPG uploads
- `DocumentCard` must have entries for all possible statuses: `uploaded`, `parsing`, `parsed`, `error`, `failed` — missing entries crash with "Cannot read properties of undefined"

### AI / OpenRouter
- Use `openai/gpt-4o` as primary model (`OPENROUTER_MODEL` env var) — `gpt-4.1` and similar aliases return 400
- `suggestMissingDeductions` prompt must request `{ "suggestions": [...] }` wrapper — `json_object` response mode requires an object, not a bare array
- Gemini direct SDK (Form 16 PDF vision) → OpenRouter Gemini 2.5 Flash → OpenRouter gpt-4o is the extraction fallback chain
