// Invoice typeface: Noto Sans (SIL Open Font License 1.1, see public/fonts/OFL.txt).
// The browser loads the faces through the @font-face rules in styles/a4Invoice.css
// under a private family name, so a system "Noto Sans" never replaces them. The PDF
// export embeds the same files, so on-screen and PDF glyph advances match.

export const INVOICE_FONT_FAMILY = 'StoneDesk Invoice Sans';

export const INVOICE_FONT_FACES = Object.freeze([
  Object.freeze({ weight: 400, style: 'normal', file: 'NotoSans-Regular.ttf' }),
  Object.freeze({ weight: 600, style: 'semibold', file: 'NotoSans-SemiBold.ttf' }),
  Object.freeze({ weight: 700, style: 'bold', file: 'NotoSans-Bold.ttf' }),
]);

// Maps a CSS font-weight to the embedded PDF face, mirroring CSS font matching for
// the three available faces: below 550 regular, 550-649 semibold, 650 and up bold.
export function pdfFontStyle(weight) {
  const value = Number.parseFloat(weight);
  const numeric = Number.isFinite(value) ? value : String(weight).trim() === 'bold' ? 700 : 400;
  if (numeric >= 650) return 'bold';
  if (numeric >= 550) return 'semibold';
  return 'normal';
}
