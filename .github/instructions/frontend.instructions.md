---
description: "Use when editing StoneDesk React components, screens, dialogs, styles or frontend API calls. Covers bilingual text, shared controls, dialogs, API call rules and draft storage."
applyTo: "Frontend/src/**"
---
# StoneDesk frontend conventions

## Text
- Every user-facing string is bilingual: `const { pick } = useLanguage();` then `pick('English', 'తెలుగు')`.
- Shared controls take `en` / `te` props: `<Button en="Log out" te="లాగ్ అవుట్" />`.
- Plain, specific wording. No emojis.

## Components
- Reuse [Controls.jsx](../../Frontend/src/components/pilot/Controls.jsx): `Button`, `Field`, `ComboField`, `DateField`, `Card`, `ErrorMessage`. `Field type="number"` renders the −/+ stepper.
- Icons come from [Icon.jsx](../../Frontend/src/components/pilot/Icon.jsx) (Radix icons). Add new names to its map rather than importing icon libraries.
- Component files export only components (oxlint `only-export-components`). Put helpers in `src/utils/`.

## Dialogs and confirmations
- Never add `window.confirm` or `alert`. Use a native `<dialog>` with `showModal()` and the `app-dialog` class.
- Follow [LogoutDialog.jsx](../../Frontend/src/components/pilot/LogoutDialog.jsx): controlled `open` prop, Escape cancels, buttons disabled while busy, title linked by `aria-labelledby`.

## API calls
- Use `request(path, { method, body, file })` from `src/lib/pilotApi.js`. It returns the JSON body; errors carry `err.status`.
- One click = only the calls it needs:
  - Settings are loaded once in `PilotApp`; pass them down as props with an `onChanged` callback. Do not refetch them in child screens.
  - Use the response of a POST/PUT/PATCH to update state locally instead of refetching lists.
  - `PilotApp.saved()` already refreshes loads after any change; navigation must not trigger another refresh.
  - Bill records passed to `BillView` are complete; do not fetch them again.

## Drafts
- Unsaved loads are AES-encrypted in localStorage. Use `writeDraft`, `readDraft`, `clearDraft`, `flushDraft` from `src/utils/pilotDraft.js`; never touch the storage key directly.

## Styles
- Workspace screens: `src/styles/workspace.css`, scoped under `.pilot.workspace`. Global controls and dialogs: `src/index.css`.
- Use existing tokens (`--ui-accent`, `--ui-ink`, `--workspace-muted`, `--workspace-border`, `--ui-radius-*`) instead of new hex values.
