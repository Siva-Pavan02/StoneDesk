---
name: Quarry Dispatch Minimalist
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#006e2d'
  on-secondary: '#ffffff'
  secondary-container: '#7cf994'
  on-secondary-container: '#007230'
  tertiary: '#005683'
  on-tertiary: '#ffffff'
  tertiary-container: '#006fa8'
  on-tertiary-container: '#dbecff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#7ffc97'
  secondary-fixed-dim: '#62df7d'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005320'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  metric-display:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.875rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

This design system is engineered for field-level industrial utility in South India, specifically targeting weighbridge operators, quarry supervisors, and transport drivers managing high-frequency truck dispatches under intense outdoor sunlight. 

The aesthetic departs completely from dated, dark, cluttered industrial software. Instead, it employs a clean, high-contrast **Minimalist Material** approach:
- **Clarity over ornament:** Uncluttered layouts with generous touch targets (minimum 48px) optimized for single-handed mobile web entry.
- **Sunlight legibility:** High-contrast crisp gray backdrops, pure white elevated cards, and restrained slate/teal accents engineered to prevent wash-out under bright glare.
- **Calm, operational trust:** Reassuring deep teal tones paired with a distinct, confident emerald green dedicated exclusively to terminal financial commitments (generating e-way bills, gate passes, and tax invoices).
- **Bilingual inclusivity:** Equal structural weight for English and Telugu typography, avoiding jarring text truncations or clipped ascenders/descenders in regional script rendering.

## Colors

The palette establishes an unambiguous operational hierarchy, using color functionally rather than decoratively.

### Core Roles
- **Primary (`#0f766e` - Deep Teal):** The operational backbone. Used for app bar branding, tab selection, active filters, selected truck statuses, and system-level navigational waypoints.
- **Secondary (`#16a34a` - Quarry Green):** Reserved strictly for positive completion events, final weighing approval, and invoice/pass generation (`Generate Invoice`, `Print Gate Pass`, `Approve Tare Weight`).
- **Tertiary (`#0284c7` - Slate Blue Accent):** Informational highlights, such as vehicle GPS tracking tags, live camera feed indicators, and external e-way bill portal sync statuses.
- **Neutral (`#64748b` - Slate Neutral):** Provides balanced optical density for secondary metadata, timestamps, vehicle plate borders, and disabled controls.

### Functional Surfaces & Tokens
- **Canvas / Background (`#f8fafc`):** Cool, glare-resistant light gray ground minimizing screen heat and reflective harshness.
- **Surface (`#ffffff`):** Pure white container cards delivering stark contrast against the canvas.
- **Surface Border (`#e2e8f0`):** Subtle defining outline around cards and form groups to preserve separation in direct sun.
- **Text Primary (`#0f172a`):** Near-black slate ensuring 12:1+ contrast ratios for critical tonnage readings and registration numbers.
- **Text Secondary (`#475569`):** Medium slate for bilingual labels, unit indicators (`MT`, `Tons`), and axle descriptions.
- **Error / Alert (`#dc2626`):** Overload warnings, tare mismatches, and blacklisted vehicle flags.

## Typography

The type system prioritizes instantaneous recognition of critical alphanumeric data (vehicle plates, gross weights, net tonnage) alongside natural bilingual rendering for English and Telugu (`Noto Sans Telugu` fallback).

### Typographic Principles
- **No Aggressive Uppercase:** Avoid forced all-caps styling on buttons and headers. Natural title case preserves readability and avoids intimidating non-technical operators.
- **Bilingual Stacking:** Telugu script requires 10-15% more vertical line space than Latin script. When paired, the Telugu label is stacked beneath the English label at `body-sm` or `label-md` with `line-height: 1.4` minimum to prevent diacritic clipping.
- **Metric Prominence:** The custom `metric-display` token is engineered with tabular figures (`font-variant-numeric: tabular-nums`) specifically for gross, tare, and net weighbridge readings to prevent layout jitter as scales fluctuate.

## Layout & Spacing

The layout is built mobile-first around a fluid single-column model (extending to a centered 640px max-width container on larger tablets mounted inside scale cabins). 

### Layout Model
- **Grid Architecture:** 4-column fluid layout on mobile screens (`< 600px`) expanding to 8-column layout on dispatch tablets (`600px - 1024px`).
- **Edge Margin:** Rigid 16px (`1rem`) outer margin ensuring all interactive fields remain well clear of hardware bezels and protective rugged phone casings.
- **Vertical Rhythm:** Strict 4px/8px incremental rhythm. Form fields use `space-md` (14px) internal vertical padding to establish a native 48px touch boundary compliant with industrial field accessibility.
- **Sticky Terminal Bar:** Critical bottom actions (invoice dispatch, gate release) are fixed to the viewport base with safe-area insets (`env(safe-area-inset-bottom)`) and framed by a top border (`#e2e8f0`) to prevent occlusion while scrolling long manifest lists.

## Elevation & Depth

Visual hierarchy relies on crisp surface layering rather than theatrical drop shadows, maximizing visibility on budget IPS displays under outdoor glare.

### Elevation Hierarchy
- **Canvas Base (Level 0):** `#f8fafc` flat background. Non-interactive.
- **Standard Card (Level 1):** `#ffffff` surface, bounded by a 1px solid `#e2e8f0` stroke and a daylight-calibrated micro-shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.05)`. Used for truck queue cards, customer details, and weight logs.
- **Active / Dragged Card (Level 2):** `#ffffff` surface, 1px solid `#cbd5e1` stroke, `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`. Used when expanding a dispatch order or viewing material breakdown.
- **Modal / Bottom Sheet (Level 3):** `#ffffff` surface with a subtle neutral backdrop overlay (`rgba(15, 23, 42, 0.4)`), elevated by `0 10px 15px -3px rgba(15, 23, 42, 0.1)`. Used for weighbridge camera capture confirmation and driver signature sign-off.

## Shapes

The design system maintains a modern, balanced architectural geometry. All form inputs, chips, and card containers implement a crisp `rounded-md` (0.375rem / 6px) structure.

### Shape Application Rules
- **Cards & Data Panels:** Fixed to `0.375rem` (6px). Clean, professional, and dense enough to allow stacked lists without excessive wasted whitespace.
- **Inputs & Select Triggers:** Standardized at `0.375rem` (6px) radius to maintain harmony with surrounding cards.
- **Status Badges & Chips:** Subtle `0.25rem` (4px) or pill shapes (`9999px`) only for operational status (e.g., `Waiting for Tare`, `Loaded`).
- **Action Buttons:** Standardized `0.375rem` (6px) rounded corners. Circular shapes are strictly restricted to floating scale refresh icons and close buttons.

## Components

### Buttons
- **Invoice Primary Action:** Emerald Green background (`#16a34a`), white text (`#ffffff`), `font-weight: 600`, minimum height of 48px, horizontal padding `1.25rem`. Hover/active state deepens to `#15803d`. Focus ring is a 2px offset with `#86efac`. Bilingual label format: Primary English title with secondary Telugu subtitle centered below in reduced size.
- **Operational Primary Button:** Deep Teal (`#0f766e`), white text, 48px height. Used for standard form transitions (e.g., `Record Gross Weight / స్థూల బరువు`).
- **Secondary / Outline Button:** Surface white, 1px solid border (`#cbd5e1`), slate text (`#334155`). Used for slip reprints, truck edits, or tare recalculations.

### Cards
- **Dispatch Order Card:** White surface, 1px border (`#e2e8f0`), shadow-sm, rounded-md. Divided into two zones:
  1. *Header Zone:* Truck registration plate rendered in high-contrast mono-spaced tracking, paired with material chip (e.g., `20mm Aggregate / కంకర`).
  2. *Data Zone:* Split columns for Gross, Tare, and calculated Net weight with distinct, oversized numerical typography.
- Never use borderless cards; crisp border definition is required to demarcate individual orders in rapid scrolling.

### Input Fields
- White background, 1px solid `#cbd5e1` border, 6px radius, height 48px. Text is 16px (`1rem`) to prevent iOS/Android browser auto-zooming on focus.
- Focused state features a crisp 1.5px solid deep teal (`#0f766e`) border with an ambient teal shadow ring (`0 0 0 3px rgba(15, 118, 110, 0.15)`).
- Permanent bilingual floating labels: English (`label-sm`, `#475569`) stacked above Telugu equivalent (`label-sm`, `#64748b`).

### Chips & Status Indicators
- **In-Queue:** Soft amber tint (`bg-[#fef3c7]`, `text-[#92400e]`, `border-[#fde68a]`).
- **Weighed / Ready:** Soft teal tint (`bg-[#ccfbf1]`, `text-[#0f766e]`, `border-[#99f6e4]`).
- **Dispatched / Invoiced:** Soft green tint (`bg-[#dcfce7]`, `text-[#15803d]`, `border-[#bbf7d0]`).
- Compact height (28px), 4px radius, `font-weight: 500`, with uppercase disabled.

### Checkboxes & Radio Controls
- Minimum 24px box size with 48px touch envelope.
- Active fill uses deep teal (`#0f766e`) with a crisp white check icon; unchecked state uses a 1.5px `#cbd5e1` border against white.
- Selection rows span full width with a light `#f1f5f9` highlight on tap.

### Weighbridge Metric Box (Domain-Specific)
- Dedicated display component for live truck scale readouts.
- Light slate enclosure (`#f1f5f9`) framed by a 1px `#cbd5e1` boundary.
- Numbers rendered in bold 32px tabular font, with dynamic live indicator (green pulse dot when scale settles, amber while weight is fluctuating).
