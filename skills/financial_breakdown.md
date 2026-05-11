# Skill: financial_breakdown

## Purpose
Analyze revenue, costs, and margins. Return a clear financial picture
with trend and 3 actionable improvements.

## Extract from input
- Revenue (total, by service/category if available)
- Cost of goods / treatment costs
- Operating expenses (rent, salary, ads, misc)
- Period (daily / monthly / quarterly)
- Previous period data for comparison

## Key calculations
- Gross margin = (Revenue - COGS) / Revenue × 100
- Net margin = (Revenue - Total costs) / Revenue × 100
- Break-even = Fixed costs / Gross margin %
- ROI on ads = (Revenue from ads - Ad spend) / Ad spend × 100

## Benchmarks (clinic/beauty Thailand)
- Gross margin: healthy > 60%, warning 40–60%, critical < 40%
- Ad ROI: good > 3x, minimum viable 2x
- Labor cost ratio: healthy < 30% of revenue
- Rent ratio: healthy < 15% of revenue

## Output format
[FINANCIAL BREAKDOWN]
──────────────────────
Revenue vs Cost ([period])
• Revenue: ฿[x]
• COGS / Treatment cost: ฿[x]
• Operating expenses: ฿[x]
• Net profit: ฿[x]

Margins
• Gross margin: [x]%  [healthy/warning/critical]
• Net margin: [x]%

Cost breakdown
• [Category]: ฿[x] ([x]% of revenue)

Trend: [up/down/flat] vs previous period

Recommendation
──────────────────────
1. [Highest-impact cost or revenue action]
2. [Second action]
3. [Third action]
