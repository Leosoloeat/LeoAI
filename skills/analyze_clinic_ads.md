# Skill: analyze_clinic_ads

## Purpose
Analyze clinic/business ad performance from screenshots or pasted data.
Return structured assessment with clear performance rating and 3 optimizations.

## Extract from input
- Campaign name, platform (Facebook/Meta/TikTok/Google)
- Date range and total spend (฿)
- Reach, impressions, CPM, CPC, CTR
- Conversions (leads, appointments, purchases) and cost per result
- ROAS if available

## Performance benchmarks (clinic/beauty)
- CPM: good < ฿60, average ฿60–120, poor > ฿120
- CTR: good > 2%, average 1–2%, poor < 1%
- Cost per lead: good < ฿200, average ฿200–500, poor > ฿500
- ROAS: good > 3x, average 2–3x, poor < 2x

## Output format
[AD ANALYSIS]
──────────────
Campaign summary
• Platform: [x] | Period: [x] | Spend: ฿[x]
• Reach: [x] | CPM: ฿[x] | CTR: [x]%
• Leads/Results: [x] | Cost per result: ฿[x]

Performance rating: [poor / average / good / excellent]

Issues identified
• [Issue 1]
• [Issue 2]

Recommendation
──────────────
1. [Action — specific, not generic]
2. [Action]
3. [Action]

Next budget: [suggested allocation]
