---
description: "Run StoneDesk frontend lint, build and unit tests and report the result"
agent: "agent"
---
Verify the StoneDesk frontend. Run each command from the `Frontend` folder, one at a time:

1. `npx oxlint src`
2. `npm run build`
3. `node --test tests/invoiceExports.test.js tests/pilotDraft.test.js tests/securityPolicy.test.js tests/calculationParity.test.js tests/googleSignIn.test.js tests/a4Invoice.test.js src/utils/dispatchCalculations.test.js src/utils/fractionParser.test.js`

Do not run `tests/interfaceDesign.test.mjs`.

Report in a short table: command, pass/fail, and for failures the file, line and message. Separate errors introduced by files changed on this branch from pre-existing warnings. Do not fix anything unless asked.
