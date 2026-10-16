# Design Tokens Master File

Source of truth: `Frontend/src/index.css` (`:root` tokens and shared `.pilot` controls), with screen styles in `Frontend/src/styles/` (`workspace.css`, `landing.css`, `invoice.css`, `a4Invoice.css`). Design intent and rules are in [DESIGN.md](DESIGN.md); screens and journeys are in [UX-SPEC.md](UX-SPEC.md).

**Stack:** Tailwind CSS 4 (`@tailwindcss/vite`), daisyUI 5 (light theme; `button`, `input`, `card` only), Motion for landing-page animation.

## Color

| Variable | Value | Use |
| --- | --- | --- |
| `--ui-accent` | `#17645D` | Primary actions, active navigation, focus outline, brand mark |
| `--ui-ink` | `#203D36` | Text and headings |
| `--ui-muted` | `#526661` | Secondary text (`--workspace-muted`) |
| `--ui-surface` | `#FFFFFF` | Cards, inputs, dialogs |
| `--ui-canvas` | `#F7F9F8` | Workspace background |
| `--workspace-border` | `#E2E8E5` | Inputs, cards, dividers |

Fixed values in shared controls: primary hover `#134E4A`; input hover border `#C9D6D0`; focus ring `rgb(23 100 93 / .12)`; error `#8B3333` text on `#FFF7F7` with `#EFCECE` border; dialog scrim `rgb(17 24 39 / .5)`.

## Typography

- **Font:** Geist (400, 500, 600, 700) and Geist Mono (400, 500) from Google Fonts.
- **Stack:** `'Geist', sans-serif`.
- **Base:** 14px / 1.5 in the workspace; inputs 16px to avoid mobile zoom.
- **h1:** `clamp(22px, 2.5vw, 28px)`, weight 600, letter-spacing `-.035em`.
- **h2, h3:** weight 600, letter-spacing `-.015em`; card titles 15px.
- **Labels and buttons:** 13px, weight 500. Eyebrow 11px, weight 700, letter-spacing `.12em`.

## Radius

| Variable | Value | Use |
| --- | --- | --- |
| `--ui-radius-xs` | 8px | Inner chips and segments |
| `--ui-radius-sm` | 10px | Buttons, inputs, textareas |
| `--ui-radius-md` | 16px | Cards and dialogs |
| `--ui-radius-lg` | 20px | Panels, nav drawer |
| `--ui-radius-xl` | 28px | Hero |
| `--ui-radius-pill` | 999px | Status tags |

## Elevation and Motion

| Variable | Value |
| --- | --- |
| `--ui-shadow-panel` | `0 12px 36px rgb(32 61 54 / .08)` (dialogs only; cards have no shadow) |
| `--ui-ease` | `cubic-bezier(.22, .61, .36, 1)` |
| `--ui-dur` | `160ms` |
| `--ui-press` | `scale(.98)` |

`prefers-reduced-motion: reduce` shortens all transitions and removes the press transform.

## Shared Controls (`.pilot` scope)

| Class | Spec |
| --- | --- |
| `.btn` | Min height 44px, padding 10px 14px, 1px border, `--ui-radius-sm`, 13px / 500 |
| `.control-button-primary` | Accent fill, white text, hover `#134E4A` |
| `.control-button-secondary` | White fill, border color, ink text, hover canvas |
| `.input` | Height 44px, 1px border, `--ui-radius-sm`, 16px text, accent border and 3px ring on focus |
| `.card`, `.control-card` | White, 1px border, `--ui-radius-md`, no shadow, 20px padding for control cards |
| `.control-error` | Error colors above, 13px text |
| `.icon-button` | 48 x 48px minimum |
| `.status-tag` | Pill, 11px / 500, 4px 8px padding |
| `.app-dialog` | Native dialog, `min(440px, 100% - 24px)`, panel shadow; `.nav-drawer` variant 300px |
| `.skip-link` | Visible on focus, accent border |

Focus: `:focus-visible` uses a 2px accent outline with 2px offset.

## Checklist

- No emojis as icons; use `pilot/Icon.jsx`.
- Text contrast 4.5:1 minimum; status shown as text, not color only.
- Visible keyboard focus and `prefers-reduced-motion` support.
- No horizontal scroll at 320px; touch targets at least 44px (48px for icon buttons).
- No dark mode.
