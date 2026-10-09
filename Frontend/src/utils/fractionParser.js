export function parseFraction(input) {
  if (input === null || input === undefined) return null;
  const str = input.toString().trim();
  if (str === '') return null;

  const fractionMap = {
    '½': { n: 1, d: 2 },
    '⅓': { n: 1, d: 3 },
    '⅔': { n: 2, d: 3 },
    '¼': { n: 1, d: 4 },
    '¾': { n: 3, d: 4 },
    '⅕': { n: 1, d: 5 },
    '⅖': { n: 2, d: 5 },
    '⅗': { n: 3, d: 5 },
    '⅘': { n: 4, d: 5 },
    '⅙': { n: 1, d: 6 },
    '⅚': { n: 5, d: 6 },
    '⅛': { n: 1, d: 8 },
    '⅜': { n: 3, d: 8 },
    '⅝': { n: 5, d: 8 },
    '⅞': { n: 7, d: 8 }
  };
  
  const reverseMap = {};
  for (const [char, val] of Object.entries(fractionMap)) {
    reverseMap[`${val.n}/${val.d}`] = char;
  }

  let whole = 0;
  let num = 0;
  let den = 1;
  let isFraction = false;

  const unicodeMatch = str.match(/^(\d*)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (unicodeMatch) {
    whole = unicodeMatch[1] ? parseInt(unicodeMatch[1], 10) : 0;
    const f = fractionMap[unicodeMatch[2]];
    num = f.n;
    den = f.d;
    isFraction = true;
  } else {
    // Regex matches: "4 1/2", "1/2", "4"
    const textMatch = str.match(/^(\d+)?\s*(?:(\d+)\/(\d+))?$/);
    if (textMatch && (textMatch[1] || textMatch[2])) {
      whole = textMatch[1] ? parseInt(textMatch[1], 10) : 0;
      if (textMatch[2] && textMatch[3]) {
        num = parseInt(textMatch[2], 10);
        den = parseInt(textMatch[3], 10);
        if (den === 0) return null;
        isFraction = true;
      }
    } else {
      const floatVal = parseFloat(str);
      if (Number.isFinite(floatVal) && str.match(/^(?:\d+(?:\.\d+)?|\.\d+)$/)) {
        return {
          numeric: floatVal,
          display: decimalToFraction(floatVal)
        };
      }
      return null;
    }
  }

  const numeric = whole + (num / den);
  let display = '';
  if (isFraction) {
    const fractionKey = `${num}/${den}`;
    const unicodeChar = reverseMap[fractionKey];
    if (unicodeChar) {
      display = whole > 0 ? `${whole}${unicodeChar}` : unicodeChar;
    } else {
      display = whole > 0 ? `${whole} ${num}/${den}` : `${num}/${den}`;
    }
  } else {
    display = whole.toString();
  }

  return {
    numeric,
    display
  };
}

export function decimalToFraction(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const n = Number(val);
  const whole = Math.floor(n);
  let dec = n - whole;
  if (dec < 1e-6) return whole.toString();
  
  let bestNum = 1;
  let bestDen = 1;
  let bestDiff = 1;
  for (let d = 2; d <= 64; d++) {
    const num = Math.round(dec * d);
    const diff = Math.abs((num / d) - dec);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestNum = num;
      bestDen = d;
    }
    if (diff < 1e-6) break;
  }

  // Only show a fraction when it equals the value; otherwise show the decimal unchanged.
  if (bestDiff >= 1e-6) return String(Number(n.toPrecision(12)));
  if (bestNum === 0) return whole.toString();
  if (bestNum === bestDen) return (whole + 1).toString();

  const fractionMap = {
    '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾',
    '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘',
    '1/6': '⅙', '5/6': '⅚', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞'
  };

  const fractionKey = `${bestNum}/${bestDen}`;
  const unicodeChar = fractionMap[fractionKey];
  
  if (unicodeChar) {
    return whole > 0 ? `${whole}${unicodeChar}` : unicodeChar;
  } else {
    return whole > 0 ? `${whole} ${bestNum}/${bestDen}` : `${bestNum}/${bestDen}`;
  }
}
