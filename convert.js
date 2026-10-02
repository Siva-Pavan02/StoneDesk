const fs = require('fs');
const html = fs.readFileSync(process.env.TEMP + '/stitch_screen.html', 'utf8');

// Extract the contents of <main> or <body>
let bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) bodyMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
let content = bodyMatch ? bodyMatch[1] : html;

// Basic HTML to JSX conversion
let jsx = content
  .replace(/class=/g, 'className=')
  .replace(/for=/g, 'htmlFor=')
  .replace(/<!--[\s\S]*?-->/g, '') // remove comments
  // Self-closing tags (very basic)
  .replace(/<input([^>]*?)>/g, '<input$1 />')
  .replace(/<img([^>]*?)>/g, '<img$1 />')
  .replace(/<br>/g, '<br />')
  .replace(/<hr>/g, '<hr />')
  // Fix inline styles (if any)
  .replace(/style="([^"]*)"/g, (match, styleString) => {
    const styleObj = styleString.split(';').reduce((acc, style) => {
      if (!style.trim()) return acc;
      let [key, value] = style.split(':');
      key = key.trim().replace(/-([a-z])/g, (m, letter) => letter.toUpperCase());
      acc.push(`${key}: "${value.trim()}"`);
      return acc;
    }, []).join(', ');
    return `style={{${styleObj}}}`;
  })
  // Fix onclick -> onClick
  .replace(/onclick="/gi, 'onClick={() => console.log("clicked")} data-original-onclick="')
  .replace(/onchange="/gi, 'onChange={() => console.log("changed")} data-original-onchange="');

// Fix unescaped entities that JSX doesn't like, e.g. &nbsp;
jsx = jsx.replace(/&nbsp;/g, '{" "}');

const componentTemplate = `
import React, { useState } from 'react';

export default function DispatchTracker() {
  return (
    <>
      ${jsx}
    </>
  );
}
`;

fs.mkdirSync('client/src/components', { recursive: true });
fs.writeFileSync('client/src/components/DispatchTracker.jsx', componentTemplate);
console.log("Successfully generated DispatchTracker.jsx");
