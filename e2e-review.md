# My end-to-end tests and review (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you found and decided.

App: Conduit practice app · Test file: `P4/tests/e2e.spec.ts` · Date: 2026-11-18

## 1. My first look
- **After I published an article by hand, I would check:** At the end I'd check the Global Feed: the first article shows my exact title, the author practice-author, today's date, my description and my tags. Then I'd open it and check that the article page shows the same title and the full body text. For a test, it should publish an article with a unique title each run, so it finds its own article and not an old one.
- **Where the page keeps my sign-in:** The key is jwtToken. Its value is my token from the sign-in, so a test can put a token under this key to open the page already signed in.

## 2. Practice
- **Worked example (the like test):** it signs in through the form as a practice user, so other tests can change its data.
- **Does its check at the end prove the journey?** No. The article heading is visible as soon as the page opens, before the click and whether or not the like worked. So line 19 is true before the journey and after it, and it proves only that the article page loaded. A real check would be the button changing to "Unfavorite Article" with the count going up by 1, and then the API: GET the article as the reader and expect favorited: true and favoritesCount: 1 (for a fresh article made by the test).

## 3. My prompt
```text
Task: Write 2 end-to-end tests in P4/tests/e2e.spec.ts. Test 1: a signed-in user publishes a new article in the editor. Test 2: a signed-in user posts a comment on an article. Make a new user with the API, give the page its token, do the journey in the page, and check the result with the API at the end. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/app/public/app.js app.js is the page's code: take the labels and button names from it. The page keeps the sign-in token in localStorage, key jwtToken.
Rules: Use app.js only for the labels and button names. Do not change the app. Do not run the tests. At the end, read the result with the API and compare the exact values the page sent (the article's unique title, description, body, tags and author, or the comment's exact text and author), so the check is false before the journey and true only after it.
```

## 4. The run
- **Claude's 2 tests:** 2 passed, 0 failed.

## 5. The teammate's question
- **Claude said:** "// A unique text for each run, so the checks can only match what this run made." and "// Signs up a new user with the API. Returns the username and token from the API's answer."
- **My answer:** No. "Its own data" means the tests don't share data. It doesn't mean they clean up. Every run leaves behind 2 new users, a new published article, and (from the comment test) a comment and probably another article. Nothing in lines 28–80 deletes them. After many runs, the Global Feed and Popular Tags fill up with test articles, and any test or person that reads the feed sees them. Fix: at the end, delete what the test made with the API (DELETE /api/articles/:slug, and DELETE the comment by its id). Put the cleanup in a finally or afterEach, so it runs even when the test fails. The users stay unless API.md has a way to delete a user.

## 6. What I saw on the home page
- At the top I see "Notes on API testing 1795019331782585" (author author1795019331734657) and "How we test the login page 1795019331357960" (author writer1795019331299272). These are the articles Claude's tests made in this run, and they're still on the home page every user sees because nothing deleted them. The test tag "login" has also appeared in Popular Tags.

## 7. My change
- **My line to Claude:** In @P4/tests/e2e.spec.ts, both tests leave their data behind: the publish test leaves its new article, and the comment test leaves its comment and the article it made. Delete them with the API in test.afterEach, so the cleanup runs even when a check fails: keep each slug and comment id the test gets from the API's answers, then DELETE /api/articles/:slug/comments/:id and DELETE /api/articles/:slug with the author's token. Change no check. Do not run the tests.
- **The clean-up Claude added:** test.afterEach deletes the comments and articles each test made, with the API, and checks that they are gone.

## 8. Proof
- **Each test twice, on an app that keeps its data:** `npx playwright test tests/e2e.spec.ts --repeat-each=2` → 4 passed, 0 failed.
- **The newest article on the home page after the run:** your plan end to end test
