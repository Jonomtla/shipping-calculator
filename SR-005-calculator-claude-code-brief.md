# SR-005 Free Shipping Profitability Calculator — Build Brief

## Context

We're running a CRO engagement for Steadyrack (premium bike racks, Shopify DTC). We've designed a shipping A/B test (SR-005) with three groups: Control (current flat rate), Var 1 (free shipping over $300), Var 2 (free shipping over $200). 

The client (Lauren, CSO) needs to see the financial impact clearly before committing. We have a spreadsheet model but want an interactive web calculator that's more persuasive and easier to play with.

## What to Build

A single-page React web app — an interactive profitability calculator for the SR-005 free shipping threshold test. Lauren should be able to adjust inputs and instantly see whether each variation is profitable.

## Styling

Match the styling of the existing CRO calculator in the `cro-calculator` GitHub repo in this project. Same fonts, colours, layout patterns, component styles. This should look like it belongs in the same family of tools.

## Inputs (editable by user, with sensible defaults)

All inputs should have sliders or number fields. Group them in a clear "Assumptions" panel.

| Input | Default | Notes |
|-------|---------|-------|
| Annual orders | 16,153 | From Shopify data |
| Average order value (AOV) | $268 | From Shopify data |
| Contribution margin % (excl CPA) | 60% | Product margin only — COGS + shipping. Slider 30-80% |
| CPA (cost per acquisition) | $45 USD | Slider $0-150 |
| Current flat rate charged on orders $300+ | $10 | What customers currently pay |
| Current standard shipping charged on orders <$300 | $30 | Average of $20-40 range |
| Orders qualifying at $300 threshold | 5,257 | 32.5% of orders |
| Orders qualifying at $200 threshold | 10,017 | 62.0% of orders |

## Outputs to Display

### 1. Variation Cards (side by side or stacked on mobile)

**Var 1: Free Shipping >$300**
- Annual shipping revenue forfeited
- Breakeven: additional orders needed + as % lift (excl CPA)
- Breakeven incl CPA (shown as secondary/muted)
- Test cost (33% traffic, 1 month)
- Verdict: visual indicator (green = easy, amber = moderate, red = tough)

**Var 2: Free Shipping >$200**
- Same metrics as Var 1

### 2. Scenario Matrix (the key visual)

A grid/heatmap showing net annual impact for Var 2 across:
- X axis: CVR lift (1%, 2%, 3%, 5%, 7%, 10%, 15%)
- Y axis: AOV lift ($0, $10, $20, $30)

Cells should be colour-coded: red for negative, green for positive, with intensity scaling. This is the centrepiece — Lauren looks at this and immediately sees where the profitable zone starts.

Show two versions of this matrix:
1. **Excl CPA** (primary, prominent) — labelled "Realistic: incremental orders don't cost ad spend"
2. **Incl CPA** (secondary, collapsed/toggle or muted) — labelled "Worst case: if every new order also costs full CPA"

### 3. Key Callouts

Auto-generated text that updates with the inputs:
- "Var 1 breaks even at just X additional orders (Y% lift)"
- "Var 2 needs Z% CVR lift alone, but only W% with a $20 AOV bump"
- "Test cost exposure: $X for one month"
- "Incremental orders from free shipping don't cost CPA — those visitors are already on site"

## Important Calculation Notes

- **Shipping revenue forfeited** is the ONLY cost. Fulfilment cost is the same regardless (it's the baseline for control). We're only losing what we currently CHARGE customers.
- **Var 1 cost:** Orders $300+ × current flat rate ($10) = revenue lost
- **Var 2 cost:** (Orders $200-300 × standard shipping $30) + (Orders $300+ × flat rate $10) = revenue lost  
- **Contribution per incremental order (excl CPA):** AOV × contribution margin %
- **Contribution per incremental order (incl CPA):** AOV × (contribution margin % - CPA/AOV)
- **Breakeven orders:** Shipping revenue lost ÷ contribution per incremental order
- **Scenario matrix cell:** (Additional orders from CVR lift × contribution per order) + (AOV lift × total orders × margin %) - shipping revenue lost
- For the incl CPA version of the matrix, use the reduced margin that accounts for CPA

## Order Distribution Reference

This data should be hardcoded (not editable) but visible as a reference table or expandable section:

| Bucket | Orders | % |
|--------|--------|---|
| $0-50 | 967 | 6.0% |
| $50-100 | 466 | 2.9% |
| $100-150 | 2,567 | 15.9% |
| $150-200 | 2,094 | 13.0% |
| $200-250 | 3,281 | 20.3% |
| $250-300 | 1,479 | 9.2% |
| $300-400 | 2,348 | 14.5% |
| $400-500 | 1,475 | 9.1% |
| $500-750 | 1,114 | 6.9% |
| $750+ | 320 | 2.0% |

Highlight that 67.5% of orders are under $300 (don't qualify for current flat rate) and 38% are under $200.

## UX Notes

- Mobile responsive — Lauren will probably look at this on her phone first
- Sliders should update everything in real time (no submit button)
- The scenario matrix is the hero element — make it large and central
- Include a small "How to read this" explainer near the matrix
- The CPA distinction (excl vs incl) should be clearly explained but not overwhelming — a toggle or tab is fine
- Consider a "Test Cost" callout card that shows the actual dollar exposure of running the test for one month at 33% traffic. This is what de-risks it for Lauren.

## Tech

- React (Next.js or Vite, whatever the cro-calculator repo uses)
- Deploy to same hosting as the CRO calculator if possible
- No backend needed — everything is client-side calculation
