# My schema, auth and contract checks (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you saw and decided.

App: Conduit practice app on my laptop · Date: 2026-11-17

## 1. My first look
How I would check that an article answer has the right shape: The test checks the keys and their types, not the exact values. It sends GET /api/articles/how-to-write-a-good-bug-report, expects status 200, and checks that "article" has exactly the 10 keys API.md lists (slug, title, description, body, tagList, createdAt, updatedAt, favorited, favoritesCount, author), with no key missing or renamed. It also checks each type: text for slug, title, description and body; a list of text for tagList; date text for createdAt and updatedAt; true/false for favorited; a number for favoritesCount; and author as an object with username, bio, image and following. Then if the new version renames, removes or changes the type of a field, the test turns red before the other apps break.

## 2. Practice: the key list check
File: `P4/materials/contract-example.spec.ts` (the sign-up answer).
Three changes: `bio` is missing · a new field `password` is added · `token` becomes a number.
- **The toMatchObject check (worked example):** missing: passes · new field: passes · number: fails
- **The key list check (my answer):** missing: fails (bio is gone, so the key list has 4 names, not 5) · new field: fails (password adds a 6th name to the key list) · number: passes (the key list checks only the names, not the type, and token is still there)

## 3. My prompt for Claude
```text
Task: Write Playwright API tests in P4/tests/contract.spec.ts. Schema checks: the answers of GET /api/articles/:slug and GET /api/user have the shape that API.md gives, checked with toMatchObject and expect.any. Auth tests: no token, a wrong token, and changing someone else's article. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. In every schema test, check both the types with toMatchObject and expect.any, and the exact sorted key list from API.md with Object.keys(...).sort() and toEqual, including the nested author object.
```

## 4. Claude's tests and my run
- **Run:** `npx playwright test tests/contract.spec.ts` · **Result:** 5 passed, 0 failed
- **A red test, and who was wrong:** No test failed.

## 5. The teammate's question
- **Claude's test:** "GET /api/articles/:slug answers with the Article shape" (from another run; my own article test already had exact key lists, lines 93–95)
- **Claude said:** "an anonymous reader gets 200 and the full Article shape."
- **My answer:** No, it stays green. Lines 44–62 use toMatchObject, which checks only the fields it lists. A new field like password in the article or in the author is never looked at, so the test passes and the leak goes unnoticed. The title "answers with the Article shape" and Claude's "the full Article shape" promise more than the check does. To catch extra or missing fields, add exact key lists: expect(Object.keys(json.article).sort()).toEqual(['author', 'body', 'createdAt', 'description', 'favorited', 'favoritesCount', 'slug', 'tagList', 'title', 'updatedAt']) and the same for json.article.author with ['bio', 'following', 'image', 'username'].

## 6. My change
- **What I asked Claude:** "In @P4/tests/contract.spec.ts, the test 'GET /api/articles/:slug answers with the Article shape' (lines 37–63) lets in extra fields, because toMatchObject checks only the fields it lists. Keep the toMatchObject check, and add checks that json.article and json.article.author have exactly the keys API.md gives for Article and Profile, with Object.keys(...).sort() and toEqual. Change nothing else. Do not run the tests." (Practice line for the test from another run. My own file already had exact key lists in both shape tests, so it was not sent.)
- **The run after it:** 5 passed, 0 failed (my own file, unchanged)

## 7. Proof: the contract test fails when the answer changes
- **My prediction before the run:** The article shape test (GET /api/articles/:slug) will fail. Line 94 compares the article's keys with ARTICLE_KEYS from API.md, so one missing field leaves one name too few and toEqual fails. The toMatchObject check fails too if the missing field is one it lists. The user shape test should still pass, because F2 changes only the article answer and line 120 checks the user. The auth tests (no token, wrong token, someone else's article) check status and error messages, so they should pass too, unless one of them reads the article back and compares it in full.
- **Run with the practice fault F2 on:** `$env:CONDUIT_FAULT = "F2"`, then `npx playwright test tests/contract.spec.ts` · **Result:** 3 passed, 2 failed: "GET /api/articles/:slug answers with the Article shape from API.md" and "PUT /api/articles/:slug on someone else's article gives 403 and changes nothing"
- **What Playwright showed:** `-     "body": "Body text of the article.",` (Expected - 1, Received + 0)
- **My answer about a red test:** After the refused PUT, this test reads the article again with a GET and compares it in full with toEqual (line 182). With F2 on, the GET answer has no "body" field, so the comparison fails. The 403 part still worked. It failed on the "changes nothing" check, because that compares the whole article.
- **Run with the fault off again:** `$env:CONDUIT_FAULT = ""`, then the same run · **Result:** 5 passed, 0 failed
