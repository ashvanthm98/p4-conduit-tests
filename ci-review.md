# My CI workflow and review (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you saw and decided.

Repository: the P4 folder · Workflow: `.github/workflows/playwright.yml` · Date: 2026-11-20

## 1. What my project needs
- **Node.js on my laptop (`node -v`):** v24.18.0
- **My whole suite on my laptop:** `npx playwright test` → 23 passed, 0 failed
- **What the GitHub computer needs (my words):** Node.js 24, the same major version as my laptop (v24.18.0). It also meets engines ">=22.13". In the workflow: actions/setup-node with node-version: 24 (or exactly 24.18.0 to match fully). Then a green run on GitHub uses the same Node as my green run here, and npm ci installs the exact packages from package-lock.json. Browser: Chromium only (from the example).

## 2. My prompt to Claude
```text
Task: Write a GitHub Actions workflow that runs this Playwright suite on every push and keeps the HTML report. My GitHub repository is the P4 folder, so save it as P4/.github/workflows/playwright.yml. After the file, write one line for each step: what it does.
Material: @P4/package.json @P4/playwright.config.ts @P4/README.md
Rules: Use actions/checkout@v6, actions/setup-node@v6 and actions/upload-artifact@v6. Do not run anything. Do not commit or push. Use Node.js 24 with actions/setup-node, install the packages with npm ci (not npm install), and install only Chromium with npx playwright install --with-deps chromium, so CI runs the suite the way my laptop ran it.
```

## 3. What Claude's workflow got wrong for my project
My own rule gave Claude Node.js 24, `npm ci` and Chromium only, so my workflow already matched my project. The developer's question was about this line from another run:
- **Claude's workflow (another run):**
  ```text
  13 |       - name: Set up Node.js
  14 |         uses: actions/setup-node@v6
  15 |         with:
  16 |           node-version: 22
  17 |           cache: npm
  ```
- **Claude said:** "ASSUMPTION: `node-version: 22` gets the newest Node 22, which is 22.13 or later. You could use 24 instead. Nothing in the material asks for a specific version."
- **My project needs:** Node.js 24 (my laptop: v24.18.0) · npm ci · Chromium only
- **My answer to the developer:** Not yet. Node 22 meets package.json's "engines": ">=22.13", so it isn't wrong for the app. But it isn't what our suite was proven on: my green run used Node 24 (v24.18.0). Claude even flagged it as an ASSUMPTION and said nothing in the material asks for a version, so that's a gap to close, not a fact. Change line 16 to node-version: 24, so a green run on GitHub proves the same thing as a green run on my laptop. Then merge.
- **My line to Claude:** In @P4/.github/workflows/playwright.yml, add a comment above line 17 (node-version: 24) that says: # Node 24 because the suite was proven green on my laptop with Node v24.18.0 (package.json engines only sets the minimum, >=22.13). Change nothing else. Do not run anything. Do not commit or push.

## 4. My reading of the workflow
- **When, where, the code and Node.js (lines 1–18):**
  - Line 1: names the workflow "Playwright tests" on the Actions tab.
  - Lines 3–4: start it on every push, to any branch.
  - Lines 6–7: one job called test.
  - Line 8: it runs on a fresh Linux computer at GitHub.
  - Line 9: GitHub stops the job if it takes longer than 30 minutes, so a stuck run can't hang forever.
  - Lines 10–12: the first step, "Get the code", copies the repository onto that computer.
  - Lines 14–18: the second step, "Set up Node.js 24", installs Node.js 24 with setup-node. Line 16's with: gives it settings, line 17 is a comment saying why it's 24, and line 18 sets the version.
- **Packages, browser, tests and the report (lines 19–36):**
  - Line 19: a setting for the Node step. It keeps the downloaded npm packages between runs, so later runs are faster.
  - Lines 21–22: "Install packages" runs npm ci, which installs exactly the versions in package-lock.json.
  - Lines 24–25: "Install Chromium" installs only Chromium, plus the Linux system libraries it needs (--with-deps).
  - Lines 27–28: "Run the Playwright tests" runs the whole suite. playwright.config.ts starts the app by itself.
  - Lines 30–36: "Keep the HTML report" saves the playwright-report/ folder as a download called playwright-report and keeps it for 30 days. Line 31's if: !cancelled() makes this step run even when tests fail (only not when the run is cancelled), so the report is there exactly when we need it most.

## 5. The first run on GitHub
- **Run:** Add the CI workflow · **Result:** … · **Tests:** …
- **The report (artifact):** …

## 6. A red run on purpose
- **The change:** `tests/example.spec.ts` line 6, `toBe(200)` → `toBe(201)`
- **My prediction:** …
- **What GitHub showed:** …

## 7. Fixed, and green again
- **The fix:** line 6 back to `toBe(200)` · **Run:** Fix the expected status · **Result:** …

## 8. Review notes for my other AI-written tests (written while CI ran)
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.
Monday's and Tuesday's tests that I did not review in depth on those days. Each one: kept, changed or removed, and why.

### Monday: `tests/api.spec.ts`
- …

### Tuesday: `tests/contract.spec.ts`
- …
