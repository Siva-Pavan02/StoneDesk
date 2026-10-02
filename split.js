const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'client/src/components/DispatchTracker.jsx');
const outDir = path.join(__dirname, 'client/src/components/dispatch');
fs.mkdirSync(outDir, { recursive: true });

let jsx = fs.readFileSync(inputPath, 'utf8');

function extractTag(html, tag, startString = `<${tag}`) {
    const startIndex = html.indexOf(startString);
    if (startIndex === -1) return null;
    let depth = 0;
    let i = startIndex;
    let inQuote = false;
    let quoteChar = '';
    
    // Very basic tag matcher
    while (i < html.length) {
        if (!inQuote && (html[i] === '"' || html[i] === "'")) {
            inQuote = true;
            quoteChar = html[i];
        } else if (inQuote && html[i] === quoteChar) {
            inQuote = false;
        } else if (!inQuote && html.substring(i, i + 2) === '<' + (html[i+1] !== '/' ? '' : '')) {
            // Check if it's opening our tag
            if (html.substring(i).startsWith(`<${tag} `) || html.substring(i).startsWith(`<${tag}>`)) {
                depth++;
            } else if (html.substring(i).startsWith(`</${tag}>`)) {
                depth--;
                if (depth === 0) {
                    const endIndex = i + `</${tag}>`.length;
                    return {
                        content: html.substring(startIndex, endIndex),
                        startIndex,
                        endIndex
                    };
                }
            }
        }
        i++;
    }
    return null;
}

// Since the HTML is mostly on one line, we can just use regex/indexOf based on known unique strings.

// 1. Header
const headerStart = jsx.indexOf('<header');
const headerEnd = jsx.indexOf('</header>') + '</header>'.length;
const headerContent = jsx.substring(headerStart, headerEnd);

// 2. Dispatch Actions (footer)
const actionsStart = jsx.indexOf('<div className="fixed bottom-0');
const actionsEnd = jsx.indexOf('</main>');
const actionsContent = jsx.substring(actionsStart, actionsEnd);

// 3. Dispatch Summary
const summaryStart = jsx.indexOf('<section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-4"><div className="flex items-center gap-2 mb-3.5"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">receipt_long</span></div><div className="flex flex-col"><h3 className="text-base font-semibold text-slate-800 leading-none">Dispatch Summary</h3>');
const summaryEnd = actionsStart; // it ends right before actions
const summaryContent = jsx.substring(summaryStart, summaryEnd);

// 4. Logistics & Transport (DispatchDetails)
const detailsStart = jsx.indexOf('<section className="flex items-center justify-between py-2 px-1 mb-2">');
const detailsEnd = jsx.indexOf('<section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4"><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800"><span className="material-symbols-outlined text-[20px]">straighten</span></div>');
const detailsContent = jsx.substring(detailsStart, detailsEnd);

// 5. The rest is Stone Measurement/Ledger
const stoneSectionStart = detailsEnd;
const stoneSectionEnd = summaryStart;
let stoneSectionContent = jsx.substring(stoneSectionStart, stoneSectionEnd);

// Split Stone Measurement into Form, Chips, Ledger
const chipsStart = stoneSectionContent.indexOf('<div className="flex items-center justify-between gap-1.5 mb-3">');
const chipsEnd = stoneSectionContent.indexOf('Tappable fractions</span></div>') + 'Tappable fractions</span></div>'.length;
const chipsContent = stoneSectionContent.substring(chipsStart, chipsEnd);

const ledgerStart = stoneSectionContent.indexOf('<div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3.5">');
const ledgerEnd = stoneSectionContent.indexOf('<div className="grid grid-cols-2 gap-3">');
const ledgerContent = stoneSectionContent.substring(ledgerStart, ledgerEnd);

const formPart1 = stoneSectionContent.substring(0, chipsStart);
const formPart2 = stoneSectionContent.substring(chipsEnd, ledgerStart);
const formPart3 = stoneSectionContent.substring(ledgerEnd);
const formContent = formPart1 + '<FractionChips />' + formPart2 + '<StoneLedger />' + formPart3;

// Create files
const writeComp = (name, content, imports = '') => {
    fs.writeFileSync(path.join(outDir, `${name}.jsx`), `import React from 'react';\n${imports}\n\nexport default function ${name}() {\n  return (\n    <>\n      ${content}\n    </>\n  );\n}\n`);
};

writeComp('DispatchHeader', headerContent);
writeComp('DispatchActions', actionsContent);
writeComp('DispatchSummary', summaryContent);
writeComp('DispatchDetails', detailsContent);
writeComp('FractionChips', chipsContent);
writeComp('StoneLedger', ledgerContent);
writeComp('StoneMeasurementForm', formContent, `import FractionChips from './FractionChips';\nimport StoneLedger from './StoneLedger';`);

const mainComp = `import React from 'react';
import DispatchHeader from './dispatch/DispatchHeader';
import DispatchDetails from './dispatch/DispatchDetails';
import StoneMeasurementForm from './dispatch/StoneMeasurementForm';
import DispatchSummary from './dispatch/DispatchSummary';
import DispatchActions from './dispatch/DispatchActions';

export default function DispatchTracker() {
  return (
    <>
      <DispatchHeader />
      <main className="flex-1 flex flex-col relative w-full max-w-xl mx-auto px-4 pt-24 bg-gray-50">
        <div className="flex flex-col w-full pb-36">
          <DispatchDetails />
          <StoneMeasurementForm />
          <DispatchSummary />
          <DispatchActions />
        </div>
      </main>
    </>
  );
}
`;

fs.writeFileSync(inputPath, mainComp);
console.log('Split complete.');
