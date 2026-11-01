import fs from 'fs';

// 1. Update Frontend/src/index.css
let indexCss = fs.readFileSync('Frontend/src/index.css', 'utf8');

const oldRootRegex = /:root\s*\{[\s\S]*?color-scheme:\s*light;\s*\}/;
const newRoot = `:root {
  --primary: #F43F4A;
  --primary-hover: #E11D48;
  --primary-soft: #FFF1F2;

  --background: #FAFAFA;
  --surface: #FFFFFF;
  --surface-secondary: #F6F7F9;

  --text-primary: #243B53;
  --text-secondary: #5F6C7B;
  --text-muted: #8A94A3;

  --border: #E5E7EB;

  --success: #16A34A;
  --warning: #D97706;
  --error: #DC2626;
  --info: #2563EB;

  --brand-primary: var(--primary);
  --brand-primary-hover: var(--primary-hover);
  --brand-primary-active: #9F1239;
  --brand-primary-soft: var(--primary-soft);
  --brand-primary-border: #FECDD3;
  --brand-primary-focus: rgb(244 63 74 / .16);
  --brand-primary-shadow: 0 4px 14px rgb(244 63 74 / .16);

  --ui-accent: var(--primary);
  --ui-accent-hover: var(--primary-hover);
  --ui-accent-soft: var(--primary-soft);
  --ui-ink: var(--text-primary);
  --ui-muted: var(--text-secondary);
  --ui-surface: var(--surface);
  --ui-canvas: var(--background);
  /* Radius scale: xs inner chips/segments, sm controls, md cards, lg panels, xl hero, pill tags. */
  --ui-radius-xs: 8px;
  --ui-radius-sm: 10px;
  --ui-radius-md: 16px;
  --ui-radius-lg: 20px;
  --ui-radius-xl: 28px;
  --ui-radius-pill: 999px;
  --ui-shadow-panel: 0 12px 36px rgb(36 59 83 / .08);
  --ui-ease: cubic-bezier(.22, .61, .36, 1);
  --ui-dur: 160ms;
  --ui-press: scale(.98);
  --workspace-border: var(--border);
  --workspace-muted: var(--ui-muted);
  /* One theme for every screen: role tokens. Screen palettes (--mn-*, --bill-*) alias these. */
  --ui-border: var(--workspace-border);
  --ui-border-strong: #D1D5DB;
  --ui-border-soft: var(--surface-secondary);
  --ui-hover: var(--surface-secondary);
  --ui-danger: var(--error);
  --ui-danger-hover: #B91C1C;
  --ui-danger-soft: #FEF2F2;
  --ui-danger-line: #FECACA;
  --ui-success: var(--success);
  --ui-success-soft: #DCFCE7;
  --ui-warning: var(--warning);
  --ui-warning-soft: #FEF3C7;
  --ui-info: var(--info);
  --ui-info-soft: #EFF6FF;
  /* Every action button is a pill, in the app and on the landing page. */
  --ui-radius-button: var(--ui-radius-pill);
  color-scheme: light;
}`;

indexCss = indexCss.replace(oldRootRegex, newRoot);
indexCss = indexCss.replace('rgb(251 71 31 / .14)', 'rgb(244 63 74 / .16)');
indexCss = indexCss.replaceAll('%23FB471F', '%23F43F4A');
fs.writeFileSync('Frontend/src/index.css', indexCss, 'utf8');
console.log('Updated index.css');

// 2. Update Frontend/src/styles/workspace.css
let workCss = fs.readFileSync('Frontend/src/styles/workspace.css', 'utf8');
workCss = workCss.replaceAll('rgb(251 71 31 / 0.14)', 'rgb(244 63 74 / 0.16)');
workCss = workCss.replaceAll('%23FB471F', '%23F43F4A');
fs.writeFileSync('Frontend/src/styles/workspace.css', workCss, 'utf8');
console.log('Updated workspace.css');

// 3. Update Frontend/src/styles/invoice.css
let invCss = fs.readFileSync('Frontend/src/styles/invoice.css', 'utf8');
invCss = invCss.replace(
  '.invoice-paper-shell { min-width: 0; padding: 6px; border-radius: 30px; background: #fef0ec; box-shadow: 0 16px 44px -28px rgb(251 71 31 / .12); }',
  '.invoice-paper-shell { min-width: 0; padding: 6px; border-radius: 30px; background: var(--surface-secondary, #F6F7F9); box-shadow: 0 16px 44px -28px rgb(36 59 83 / .08); }'
);
fs.writeFileSync('Frontend/src/styles/invoice.css', invCss, 'utf8');
console.log('Updated invoice.css');

// 4. Update Frontend/src/styles/landing.css
let landCss = fs.readFileSync('Frontend/src/styles/landing.css', 'utf8');
landCss = landCss.replaceAll('#FB471F', '#F43F4A');
landCss = landCss.replaceAll('#e03813', '#E11D48');
landCss = landCss.replaceAll('#c92e0c', '#9F1239');
landCss = landCss.replaceAll('#fef0ec', '#FFF1F2');
landCss = landCss.replaceAll('#fcd5cb', '#FECDD3');
landCss = landCss.replaceAll('rgb(251 71 31 /', 'rgb(244 63 74 /');
landCss = landCss.replaceAll('#ff6b4a', '#fb7185');
landCss = landCss.replaceAll('#b82a0b', '#9f1239');
fs.writeFileSync('Frontend/src/styles/landing.css', landCss, 'utf8');
console.log('Updated landing.css');

