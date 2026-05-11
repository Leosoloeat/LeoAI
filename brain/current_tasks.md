# Current Tasks

## Live on Railway
- LINE OA bot: leoai-production.up.railway.app
- Gemini 2.5 Flash (primary) + 5 OpenRouter fallbacks
- Per-model cooldown + health scoring
- Web search: Tavily API (auto-detect + /search /news)

## Memory System (Google Sheets)
- All actions use POST — avoids GET redirect/auth issues
- RAM fallback when Sheets is unreachable (bot never crashes)
- Commands: /remember, /memory, /forget
- /remember key: value → structured key-value storage
- /memory → shows user's own memories (user-scoped)
- /forget key → deletes all entries with that key

## Pending — Leo must do
1. Open script.google.com → paste new google-apps-script.js → Save
2. Run setup() → allow permissions
3. Deploy → New version → copy URL
4. Add to Railway env: GOOGLE_SHEETS_WEBHOOK=<new url>
   (The stored LEOAI_SHEET_ID had URL instead of ID — new code auto-fixes this)
