@AGENTS.md

# Process Hub — Project Intelligence

## What this project is

An AI-powered internal tool for a medical device product data specialist. It reads the user's SOP (Standard Operating Procedure) documents and uses them to:
1. Attribute every field (N through 17) for a product given a description, URL, or image
2. Answer specific rule questions by querying the SOPs
3. Match products to the right NTC (Noun/Type/Category) from an uploaded Excel sheet
4. Let the user browse and search their rule documents with inline AI chat

The user's SOPs are Word documents (`.docx`) describing how to fill in product catalogue fields for medical devices (catheters, needles, implants, etc.).

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js App Router | Version in package.json. AGENTS.md warns of breaking changes — always read `node_modules/next/dist/docs/` before touching routing |
| Styling | Tailwind v4 | CSS `@theme inline {}` in globals.css — NO `tailwind.config.ts`, NO utility classes from v3 config |
| AI | Groq API (groq-sdk) | Free tier. Two models: `llama-3.3-70b-versatile` (text), `meta-llama/llama-4-scout-17b-16e-instruct` (vision/image) |
| Doc extraction | mammoth (.docx), pdf-parse (.pdf), xlsx (.xlsx/.xls/.csv) | All via dynamic import in API routes |
| Icons | lucide-react | |
| API key | `GROQ_API_KEY` in `.env.local` | Never commit `.env.local` — it's in `.gitignore` |

---

## Directory structure

```
src/
  app/
    page.tsx              # Home: hero + 3 feature cards
    layout.tsx            # Root layout: Navbar + Footer
    analyze/page.tsx      # AI Assistant (text/URL/image → field attribution)
    sops/
      layout.tsx          # Thin wrapper — NO sidebar (just renders children)
      page.tsx            # Interactive rules viewer (three-panel + chat drawer)
    ntc/page.tsx          # NTC Lookup (product text or URL → best NTC match)
    rules/page.tsx        # Document management: upload, scan, delete
    api/
      analyze/route.ts    # POST: core AI attribution endpoint
      ntc/route.ts        # POST: NTC matching endpoint
      upload/route.ts     # POST: file upload + text extraction
      documents/
        route.ts          # GET (list without content), DELETE by id
        content/route.ts  # GET (list WITH full content, for rules viewer)
        scan/route.ts     # POST: scan /uploads/ and register untracked files
  components/
    layout/Navbar.tsx     # Nav: AI Assistant, Rules, NTC Lookup, Manage Docs
    layout/Footer.tsx
    layout/Sidebar.tsx    # Unused in current pages (kept for reference)
  lib/
    claude.ts             # Groq client + GROQ_MODEL + GROQ_VISION_MODEL + SYSTEM_PROMPT
    documents.ts          # Manifest CRUD + cleanDocContent() + getAllDocumentContent()
    excel.ts              # parseExcel(), excelToText() for NTC sheet
    utils.ts              # cn(), formatDate(), slugify()
  types/sop.ts            # TypeScript types (SOP, SOPStep, etc. — legacy, may be unused)
data/
  documents.json          # Runtime manifest of uploaded docs — NOT committed
uploads/                  # Actual uploaded files — NOT committed
```

---

## Document storage system (`src/lib/documents.ts`)

- **Manifest**: `data/documents.json` — array of `DocumentRecord` objects
- **Files**: stored in `uploads/` with UUID filename (e.g. `a1b2c3.docx`)
- **Types**: `"rule"` | `"ntc-excel"` | `"reference"`
- **NTC Excel**: only one at a time; detected by filename containing "ntc" or being `.xlsx`
- **Deduplication**: by `id` OR by original `name` — re-uploading same filename replaces it

### `cleanDocContent(raw: string): string`
Cleans extracted text from Word/PDF:
- Replaces `\xa0` (non-breaking space) with regular space
- Detects and removes the entire **Table of Contents block** (lines with `\t\d+` at end)
- Removes standalone page numbers (1–3 digit lines)
- Collapses multiple blank lines to one
- Applied at: upload time, scan time, display time (rules viewer), AI context time

### `getAllDocumentContent(query?: string): string`
- Ranks docs by keyword overlap with query
- Returns top 3 most relevant docs, each capped at 4,000 chars
- Always runs `cleanDocContent()` before truncating
- **Why capped**: Groq free tier has ~6K token effective limit per request

---

## AI system (`src/lib/claude.ts` + `src/app/api/analyze/route.ts`)

### Models
```
GROQ_MODEL        = "llama-3.3-70b-versatile"        # text, 128K context
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"  # image input
```

### System prompt behavior (SYSTEM_PROMPT in claude.ts)
**Two modes — auto-detected by the route:**

**Full attribution mode** (product info given, no question mark):
- Outputs all 17 fields in SOP format:
  ```
  N (NOUN): CATHETER
  T (TYPE): INTRAVASCULAR
  1 (TRADEMARK/BRAND NAME): —
  2 (COMPOSITION): POLYURETHANE
  ...
  17 (FLAGS): —
  ```
- ALL CAPS values, semicolons to separate multiple values
- Dash (—) for fields that can't be determined
- **Never cites document names or sections**

**Question answer mode** (input contains `?` or starts with what/how/why/etc.):
- Answers directly and concisely
- Follows SOP formatting conventions (ALL CAPS, abbreviations, etc.)
- **Never cites document names**

### SOP field numbering (the actual fields)
`N` NOUN · `T` TYPE · `1` TRADEMARK/BRAND NAME · `2` COMPOSITION · `3` LOCATION · `4` SIZE/SHAPE · `5` PRIMARY LENGTH/WIDTH/HEIGHT · `6` SECONDARY LENGTH/WIDTH/HEIGHT · `7` OUTER/INNER DIAMETER · `8` VOLUME · `9` WEIGHT · `10` AGE · `11` GENDER · `12` PROPERTIES · `13` COLOR · `14` FLAVOR · `15` FRAGRANCE · `16` MISCELLANEOUS · `17` FLAGS

### NTC matching (`src/app/api/ntc/route.ts`)
- Parses NTC Excel locally (never sends full 2.7MB file to AI)
- Keyword-scores all rows against the query
- Sends top 20 matching rows to Groq
- Returns top 3 NTC combinations with explanation

---

## Rules viewer (`src/app/sops/page.tsx`)

Three-panel layout:
- **Left (220px)**: document list + cross-document search bar
- **Center (flex-1)**: formatted document content OR search results
- **Right (176px)**: auto-generated section TOC (clickable, scroll-to)
- **Chat drawer**: slides in from right, scoped to selected document

### Content rendering (`RenderedDoc` + `classifyLine`)
Line classification priority:
1. `attr-header`: `N – NOUN`, `T – TYPE`, `1 – TRADEMARK/BRAND NAME` style → dark pill badge
2. `section-header`: ALL CAPS or ends with `:` → bold underlined heading
3. `toc-entry`: tab + digit at end → skipped (cleaned before reaching renderer)
4. `example`: starts with `EX:` or `EXAMPLE:` → green code block
5. `bullet`: starts with `- • ●` → bullet list item
6. `numbered`: starts with `1.` `a)` etc. → numbered item
7. `unspsc`: exactly 8 digits → code badge + description + keywords on same row
8. `paragraph`: everything else

---

## Key gotchas

### Groq token limits
Free tier: ~6K tokens effective per request. Current mitigations:
- Top 3 docs only, 4K chars each = ~3K tokens for rules context
- NTC: keyword-match locally, send only top 15–20 rows
- `max_tokens: 1500` on responses

### Word document extraction
`mammoth.extractRawText()` strips all formatting. Tables come out as flat text with each cell on its own line separated by `\n\n`. Pipe separators do NOT come from mammoth — they'd need to be in the original doc text. The `cleanDocContent()` function handles the most common artifacts.

### Non-breaking spaces
Word docs are full of `\xa0`. Always run `cleanDocContent()` or at minimum `.replace(/\xa0/g, ' ')` before displaying or sending to AI.

### Dev server
```bash
npm run dev > /tmp/nextdev.log 2>&1 &  # start in background
tail -f /tmp/nextdev.log               # watch logs
pkill -f "next dev"                    # stop
```

### Git / deployment
- Remote: `git@github.com:Rtnkr/epim.git`
- Branch: `main`
- `.env.local` is gitignored — **never commit it**
- `uploads/` and `data/` are gitignored — runtime data only
- After changes: `git add src/ && git commit -m "..." && git push`

---

## SOP formatting rules (from the actual documents)

- Values always in **ALL CAPS**
- Semicolon `;` to separate multiple values in one field
- No trailing zeros: `2MM` not `2.0MM`
- Leading zero before decimals: `0.035IN` not `.035IN`
- Remove plural "s" in most cases (`HOLE` not `HOLES`)
- Exceptions: FORCEPS, GRASPERS, SCISSORS, CALIPERS, PANTS, SLIPPERS
- Remove `-ing` verbs: `HARVEST` not `HARVESTING`
- Remove `-ed/-d` adjective suffix: `ANGLE` not `ANGLED`
- Exceptions: CANNULATED, LOCKING, PERFORATED, BRAIDED, CUFFED, CEMENTED, FIXED
- Allowed special chars: `;` `+` `=` `.` `/` `%` `&` (& only in trademarks/composition)
