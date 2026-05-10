# Current Tasks

- LINE OA bot live บน Railway: leoai-production.up.railway.app
- Primary AI: Gemini 2.5 Flash
- Fallback chain: deepseek/deepseek-chat-v3-0324:free → qwen/qwen3-32b:free → google/gemma-3-27b-it:free → mistralai/devstral-small:free → moonshotai/kimi-k2:free
- ระบบ per-model cooldown + health scoring ทำงานปกติ
- Monitor fallback success rate และ Gemini quota usage
