# My practice fault report (week 4, project P4)

App: Conduit practice app on my laptop · Practice faults: `P4/faults/practice.json` (F1 to F6) · Date: 2026-11-19
**How to read it:** a "detect" fault is **caught** when at least one test that passed with no fault fails with it, and **missed** when every test still passes. A "robust" fault (the app is only slower) should **stay green**; if tests fail, it **went red**.

## 1. My guess this morning
- **The developer asked:** "Your suite is green. How many real problems would it catch?"
- **My answer:** I don't know yet, because green only shows that the checks passed on a working app. We know of a few problems it does catch: the PUT tagList bug (marked with test.fail) and fault F2 (the missing body field). To find out how many real problems it would catch, I'd turn on the app's practice faults one at a time, run all 17 tests for each, and count how many faults turn at least one test red. A fault that leaves the suite green shows a gap, and I'd add or strengthen a test for it.

## 2. Before: my suite against the practice faults
- **Command:** `node materials/faults-run.mjs` (TESTS terminal, in `P4`, with no app running)
- **My test files:** `api.spec.ts`, `contract.spec.ts`, `e2e.spec.ts`, `example.spec.ts`, `profile-follow/follow.spec.ts`, `profile-follow/unfollow.spec.ts`, `seed.spec.ts`
- **No fault:** 20 passed, 0 failed
- **F1** (Opening an article gives a server error (500)): caught (7 tests failed)
- **F2** (The article answer has no body text): caught (5 tests failed)
- **F3** (The article answer has a different title): caught (5 tests failed)
- **F4** (The comments list is always empty): caught (1 test failed: the e2e comment test)
- **F5** (The article answer comes 3 seconds late): stayed green
- **F6** (Posting a comment is refused (422) and nothing is saved): caught (1 test failed: the e2e comment test)

## 3. The weak spot I chose, and why
The weakest spot is comments. F4 (the comments list is always empty) and F6 (posting a comment is refused with 422) are each caught by only one test, the e2e comment test. If that test breaks or is removed, both faults go unnoticed. A good suite should catch F6 at the API level too: an API test that posts a comment, expects 201 with the exact comment text, then reads GET /api/articles/:slug/comments and finds it. That test would also catch F4.

## 4. How I made the suite stronger
- **My request for Claude** (the New tests line of `P4/prompts/stronger.md`): Only one test checks comments, so posting and reading comments has a weak spot. Write P4/tests/comments.spec.ts with 2 API tests, each with its own new user and article made by API: (1) a new user posts a comment, the answer is 201 with the exact comment text and the user as author, then GET /api/articles/:slug/comments lists exactly that comment with the same text; (2) posting a comment with no token gives 401 {"errors":{"token":["is missing"]}}, and GET of the comments shows the list is still empty. Take the comment id and slug from the API's answers, and delete the comment and article in test.afterEach.
- **New or changed test file:** `tests/comments.spec.ts` (new: "a new user posts a comment and reads it back", "posting a comment with no token is refused and saves nothing"); `tests/profile-follow/follow.spec.ts` and `unfollow.spec.ts` (changed, see `agent-review.md`)

## 5. After: the run again
- **Command:** `node materials/faults-run.mjs F4 F6`
- **No fault:** 23 passed, 0 failed (after the red "No fault" line was fixed, see `agent-review.md` part 4)
- **The faults I chose:**
  - F4: caught (2 tests failed: comments.spec.ts › a new user posts a comment and reads it back; the e2e comment test)
  - F6: caught (3 tests failed: both comments.spec.ts tests; the e2e comment test)

## 6. What changed
Now I can answer with numbers. With the app's 6 practice faults, the suite catches all 5 "detect" faults (F1, F2, F3, F4, F6) and stays green for the "robust" one (F5, a slow answer), which is right. The weak spot was comments: F4 and F6 were each caught by only one test. After adding comments.spec.ts, F4 is caught by 2 tests and F6 by 3, so one broken test no longer hides them. Along the way the suite also found a real bug: the profile answer leaks the user's email. That's kept visible as one known bug with test.fail(). Two limits: these are only the faults we tried, and none of them touches following, so we don't know yet how well the follow tests catch problems.
