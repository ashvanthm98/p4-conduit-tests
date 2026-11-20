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
- **Run:** Add the CI workflow · **Result:** green tick · **Tests:** 23 passed (the same as my laptop)
- **The report (artifact):** yes, playwright-report is under Artifacts

## 6. A red run on purpose
- **The change:** `tests/example.spec.ts` line 6, `toBe(200)` → `toBe(201)`
- **My prediction:** The step "Run the Playwright tests" turns red. In example.spec.ts, line 6 expects status 201, but GET /api/tags only reads data, so the app answers 200. Expected: 201, Received: 200. The test stops there, so line 8 never runs. The other 22 tests still pass, the job gets a red cross, and the step "Keep the HTML report" still runs because of if: !cancelled(), so the report is there to download.
- **What GitHub showed:** The failed step "Run the Playwright tests" shows "the API lists the popular tags" failing at example.spec.ts line 6: Expected 201, Received 200. 1 failed, 22 passed, and "Keep the HTML report" still ran, so the report is ready to download. My prediction was right.

## 7. Fixed, and green again
- **The fix:** line 6 back to `toBe(200)` · **Run:** Fix the expected status · **Result:** green, 23 passed

## 8. Review notes for my other AI-written tests (written while CI ran)
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.
Monday's and Tuesday's tests that I did not review in depth on those days. Each one: kept, changed or removed, and why.

### Monday: `tests/api.spec.ts`
- "read: GET by slug returns 200 with the same article that was created": **kept**, because it checks 200 and the whole article with toEqual, the same createdAt as the create answer, and its own user.
- "delete: the author deletes the article, gets 204 with no body, and the article is gone": **kept**, because it checks 204 with an empty body, then reads the article again and gets 404 "not found", so the delete really happened.
- "create without a token gives 401 "token is missing"": **changed**, because 401 and the exact error are right, but it never reads the data again. Give the article a unique title, then GET /api/articles and check no article has that title, so the refused create saved nothing.
- "create with a wrong token gives 401 "token is invalid"": **changed**, because the same as 3. Add the read-back with a unique title, so the wrong token really saved nothing.
- "update by a user who is not the author gives 403 "article forbidden" and the article does not change": **kept**, because 403 with the exact error, and it reads the article again and finds it unchanged. That's the full negative case.
- "delete an article that was already deleted gives 404 "article not found"": **kept**, because the first delete gives 204 and the second gives 404 with the exact error. There's no data left to change, and test 2 already checks that a deleted article is gone.

### Tuesday: `tests/contract.spec.ts`
- "GET /api/user answers with the User shape from API.md": **kept**, because it checks 200, exact values, the token's type, and exact key lists for the answer and the user (shape), with its own user. That's the full contract check.
- "GET /api/user without a token gives 401 "is missing"": **kept**, because 401 with the exact error, its own user, and a read-back with the right token. A GET doesn't change data, so the read-back mostly proves the user still works. toMatchObject is fine there, because test 1 already checks the exact shape.
- "GET /api/user with a wrong token gives 401 "is invalid"": **kept**, because the same as 2, for a wrong token. 401 with the exact "is invalid" error is a different case from a missing token, so it's not a repeat.
