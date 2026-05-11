# Skill: analyze_funnel

## Purpose
Analyze conversion funnel — identify the biggest drop-off stage and give
actionable fixes. Works with both text data and funnel screenshots.

## Extract from input
- Stage names and volumes (e.g., reach → click → DM → consult → book → treat)
- Drop-off % at each transition
- Time period
- Channel source if mentioned

## Funnel benchmarks (clinic/beauty)
- Click → DM rate: good > 5%, poor < 2%
- DM → consultation: good > 40%, poor < 20%
- Consultation → booking: good > 60%, poor < 30%
- Booking → show rate: good > 85%, poor < 70%
- Consult → treatment (close rate): good > 50%, poor < 25%

## Output format
[FUNNEL ANALYSIS]
──────────────────
Stage breakdown
[Stage] → [Stage]: [n] people | [x]% conversion ← [flag if poor]

Biggest drop-off: [stage transition]
Estimated revenue leak: [if calculable]

Root cause
• [Why this stage drops — specific, not generic]

Recommendation
──────────────────
1. [Fix for drop-off stage]
2. [Supporting action]
3. [Quick win]
