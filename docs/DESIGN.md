# StoneDesk design system

## 1. Visual theme and atmosphere

A practical yard ledger, made clear enough to read outdoors. Restrained density (6/10), predictable layout (3/10), minimal motion (1/10). The business identity leads; operational controls come before decorative content. The interface remains a single mobile column, centered at a maximum 512px on larger screens. There is no desktop dashboard expansion or dark mode.

## 2. Color palette and roles

| Token | Value | Purpose |
| --- | --- | --- |
| Yard canvas | `#F9FAFB` | Gray-50 page background |
| Paper | `#FFFFFF` | Cards, dialogs, inputs and navigation |
| Ink | `#111827` | Primary labels, figures, body text |
| Secondary ink | `#374151` | Explanations and metadata |
| Quiet ink | `#4B5563` | Secondary metadata, never disabled-looking primary text |
| Input boundary | `#D1D5DB` | 2px input borders |
| Structural line | `#E5E7EB` | 1px dividers |
| Yard green | `#115E59` | One brand accent: primary actions and active navigation |
| Focus green | `#0F766E` | 3px focus outline with 2px offset |
| Soft green | `#F0FDFA` | Supporting active backgrounds with dark text |
| Error ink | `#991B1B` | Error text only, paired with text explanation |

Status uses words as well as color. Red is reserved for errors, not an additional brand accent. The reference bill's muted red wordmark is a document branding treatment, separate from software navigation.

## 3. Typography

Reuse Plus Jakarta Sans already installed in the project, with Noto Telugu for Telugu and sans-serif fallbacks. Do not introduce another webfont or typography package. Show only the selected language; remember the language per device and set the document language.

| Use | Size / line height | Weight |
| --- | --- | --- |
| Landing headline | 36–48px / 1.12 | 700 |
| Screen title | 24px / 32px | 700 |
| Section title | 18–20px / 28px | 700 |
| Body and input text | 16px / 24px | 400–600 |
| Supporting text | 14px / 21px | 400–600 |
| Nonessential metadata | 12px / 18px | 400 |
| Short section eyebrow | 11px / 16px | 700; modest tracking |

Numbers use tabular figures. Amounts use Indian grouping and two decimal places where financial precision matters. Reserve serif lettering for the printable business wordmark; all app screens use sans-serif.

## 4. Components

- Buttons: minimum 48px tall, 12px corners, text labels, stable width while busy. Primary actions have green fill and white text. Secondary buttons are white with gray borders. Use a visible focus outline, pressed feedback and a disabled HTML state while submitting. No hover-only actions.
- Inputs: labels above controls, 16px text, white fill, gray 2px borders, minimum 48px height. Native email, password, date, number, file and select controls. Keep fractions available on dimension entry. Never use a placeholder as the only label.
- Cards: white with a subtle shadow, 16px corners and 16px padding. Use them to group a load or a task; use dividers inside groups instead of nested cards.
- Navigation: collapsible side drawer for all five destinations; four compact bottom destinations for daily work. Settings is available in the drawer/profile area. All hit areas are at least 48px tall.
- Dialogs: native modal dialog for sign-in, navigation and information. Browser focus containment, Escape to close, labeled title, visible close button. The scrim is 50% ink. No hand-built focus trap.
- Data: load cards on phones, containing lorry number, party, date, area, amount and textual status. The generated PDF and Excel are the detailed tabular views. Right-align numerical columns, repeat headings on new PDF pages, and preserve numeric Excel cells.
- Empty states: explain the next action. Search with no matches suggests lorry, party or bill ID. Empty invoices direct the user to create and finalize a load.
- Errors: retain input, use an alert with a concrete message, offer retry where useful. Native field validity handles basic required fields; the server validates all financial input and access permissions.
- Loading: reserve screen space; show a short status and neutral skeleton blocks. Submission controls say Saving or Preparing and prevent repeat taps.

## 5. Layout

Use a 4px base spacing scale: 8px related controls, 12px compact groups, 16px cards/gutters, 24px sections, 32–40px landing sections. No horizontal page overflow at 320px. A two-column summary is permitted for short numbers; forms remain single column. Bottom navigation has safe-area padding and matching content clearance.

The utility header contains business identity, the language toggle, notifications and search. Search accepts lorry number, party, destination or bill ID. The adjacent plus button starts a load. The mobile drawer also provides the signed-in profile, role and logout.

## 6. Motion and accessibility

Use CSS only: 150ms color/press feedback. Honor reduced motion. Avoid perpetual animation during yard entry, animated counters, parallax, and staggered movement of operational rows. This prioritizes the UI/UX skill's accessibility and task-focus rules over decorative motion suggestions from taste-design.

Visible keyboard focus, a skip link, semantic headings/labels, text status indicators, native dialogs, and 48px hit areas are required. Test at 320px and 390px plus landscape. Long business names and Telugu text wrap without covering controls.

## 7. Deliberate exclusions

No neon colors, gradients, emoji icons, fake counters, fabricated testimonials, invented security certifications, or stock photos pretending to show customer yards. Social proof needs real, approved customer evidence. No dark mode, custom date picker, chart library, animation library or desktop sidebar framework for this pilot.

## 8. Library decision

Keep React, Tailwind v4, daisyUI 5, jsPDF/AutoTable and SheetJS already installed. Native dialog and form controls cover the current interaction requirements with no new dependencies. The pick-ui-library curated choice for more complex accessible primitives is [Base UI](https://base-ui.com/react/components/dialog); consider it if nested menus or richer dialog behavior become necessary. Do not replace working daisyUI controls to introduce it now. daisyUI's [button](https://daisyui.com/components/button/), [input](https://daisyui.com/components/input/) and [card](https://daisyui.com/components/card/) patterns remain the base.
