# Tests from Playwright's agents, and my review (week 4, project P4)

App: Conduit practice app on my laptop · Date: 2026-11-19

## 1. How I set up the agents
- **Command:** `npx playwright init-agents --loop=claude` (TESTS terminal, in `P4`)
- **What it made:** `.claude/agents/playwright-test-planner.md`, `.claude/agents/playwright-test-generator.md`, `.claude/agents/playwright-test-healer.md`, `.mcp.json`, `specs/README.md`, `tests/seed.spec.ts`
- **Browser hidden:** `"--headless"` added to `P4/.mcp.json`: yes
- **Where I started Claude for the agents:** in `P4`, because Claude finds the agents and their browser only there

## 2. What I asked the agents
- **Area:** the profile page and following an author
- **My prompt** (`P4/prompts/agents.md`):
  - Task: First use the playwright-test-planner agent to plan tests for the profile page and following an author. Save the plan as specs/profile-follow.md. Then use the playwright-test-generator agent to write one test for each scenario in the plan, in the folder tests/profile-follow/.
  - Material: Start on the page /profile/practice-author. For steps that need a signed-in user, use a practice user from README.md.
  - Rules: Plan at most 2 short scenarios, with at most 5 steps each. Do not change any other test file. Do not run the test suite. Each check must be false before the step and true after it (for example, the button changes from "Follow practice-author" to "Unfollow practice-author" and GET /api/profiles/practice-author answers following: true), and a test.afterEach must unfollow again so the practice user is left as it was.
- **The plan the planner saved:** `specs/profile-follow.md`
- **The test files the generator wrote:** `tests/profile-follow/follow.spec.ts` ("Signed-in reader follows practice-author"), `tests/profile-follow/unfollow.spec.ts` ("Signed-in reader unfollows practice-author")
- `tests/seed.spec.ts` is the agents' start file. It checks nothing about the app, so it is not reviewed here.

## 3. My review of every generated test
- **The teammate's question:** "Claude says its `test.afterEach` unfollows again. So we can keep this test in our suite as it is, right?"
- **My answer:** Not as it is. The afterEach does unfollow, but the test still uses the shared practice user practice-reader, which other tests and people also use. While it runs, practice-reader really follows practice-author, so a test that runs at the same time (for example in parallel) can see the wrong state. Line 34 resets the state first, which can hide a leftover follow from another run. It also signs in through the form (lines 23–26) with the password written in the test, though the journey we care about is the follow, not the sign-in. Better: make a new reader (and a new author) with the API, give the page the token through jwtToken, and keep the afterEach. Then the test touches nobody else's data.
- "Signed-in reader follows practice-author" (`follow.spec.ts`) · **changed**, because it's useful: it checks the follow journey before and after, on the page and by API. But it signs in as practice-reader, a shared user, and follows practice-author, another shared user, with the password written in the test. It must sign up its own reader and author by API, give the page the reader's token through jwtToken instead of the sign-in form, follow the new author, and keep the afterEach that unfollows.
- "Signed-in reader unfollows practice-author" (`unfollow.spec.ts`) · **changed**, because it's useful: it checks the unfollow journey before and after, on the page and by API (lines 43, 65), so it isn't a repeat of the follow test. But by Wednesday's habit and my checklist it must change:
  - Own data: it uses the shared practice-reader and practice-author. It must sign up its own reader and author by API and give the page the token through jwtToken.
  - Line 7: the email and password are in the test (lines 24–25). They should come from LoginPage or, better, be gone once the test signs up its own user.
  - Line 6: line 30 uses toBeTruthy(). It's better to check the token from the sign-up answer.
  - Line 4: lines 38, 50 and 58 use toBeVisible() as the only check.
  - Line 8: all the locators are written in the test, not in a page object.

## 4. What I asked Claude to change, and the result
- **My change** (the Changes line of `P4/prompts/stronger.md`): In @P4/tests/profile-follow/follow.spec.ts: It signs in as practice-reader, a shared user, and follows practice-author, another shared user, with the password written in the test. It must sign up its own reader and author by API, give the page the reader's token through jwtToken instead of the sign-in form, follow the new author, and keep the afterEach that unfollows. In @P4/tests/profile-follow/unfollow.spec.ts: Own data: it uses the shared practice-reader and practice-author. It must sign up its own reader and author by API and give the page the token through jwtToken. Line 7: the email and password are in the test (lines 24–25). They should come from LoginPage or, better, be gone once the test signs up its own user. Line 6: line 30 uses toBeTruthy(). It's better to check the token from the sign-up answer. Line 4: lines 38, 50 and 58 use toBeVisible() as the only check. Line 8: all the locators are written in the test, not in a page object.
- **After the change, a red "No fault" line:** both changed tests failed at the `toEqual` check of `GET /api/profiles/:username`: the answer had an extra `"email"` field.
  - **My decision:** Nothing. The tests are right and the answer is wrong. API.md's Profile has exactly username, bio, image and following (our PROFILE_KEYS), with no email. The app is sending another user's email address to anyone who reads their profile, which is a privacy leak. toEqual caught it because it compares the whole answer. If we switched to toMatchObject, the leak would pass unnoticed.
  - **How I kept the suite green:** The second way. I'll move the exact profile check (toEqual with exactly username, bio, image, following) into its own small test marked with test.fail() and a comment naming the email leak. The follow tests then check only the follow part, for example (await response.json()).profile.following toBe(true) or false. That way a broken follow button still turns them red, the leak stays visible as one known bug, and when the app stops sending email, the small test turns red to tell us the fix landed.
  - **WORK line:** `Follow the prompt in @P4/prompts/fix-profile.md`. Claude added the test "GET /api/profiles/:username gives exactly the Profile fields from API.md" with `test.fail();` (`follow.spec.ts` line 63).
- **Result:** No fault: 23 passed, 0 failed
