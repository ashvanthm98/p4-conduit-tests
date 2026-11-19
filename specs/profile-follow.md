# Profile page and following an author

## Application Overview

Plan for /profile/practice-author in the Conduit practice app (baseURL http://127.0.0.1:3000). Signed-in user: practice-reader (practice-reader@example.com / Practice123, from README.md). Never sign in as practice-author (cannot follow yourself).

Locators seen on the page (use getByRole):
- Signed out profile page: heading level 1 "practice-author"; NO follow button is shown. Nav: link "conduit", link "Home", link "Sign in", link "Sign up". Tabs: navigation "Profile articles" with links "My Articles", "Favorited Articles".
- Sign in page (/login, reached by link "Sign in"): heading "Sign in"; textbox "Email"; textbox "Password"; button "Sign in"; link "Need an account?". After sign in the app goes to / (Home).
- Signed in profile page: button "Follow practice-author" (not followed) or button "Unfollow practice-author" (followed). The name changes after the click.
- Token: after sign-in the page stores it in localStorage key "jwtToken". Read it with page.evaluate(() => localStorage.getItem('jwtToken')) and send `Authorization: Token <token>` to GET /api/profiles/practice-author.

Observed (not in the plan scenarios): at the start of exploration practice-reader was ALREADY following practice-author (button said "Unfollow practice-author", API following: true). So the fresh data is not "unfollowed". Each test must first make sure the start state is unfollowed (DELETE /api/profiles/practice-author/follow with the practice-reader token) in a beforeEach or at the start of the test, and the "before" checks must be run after that.
Also observed: the profile API answer has an extra field "email" that API.md does not list.

## Test Scenarios

### 1. Profile page and following

**Seed:** `tests/seed.spec.ts`

#### 1.1. Signed-in reader follows practice-author

**File:** `tests/profile-follow/follow.spec.ts`

**Steps:**
  1. Setup: sign in as practice-reader through the form (open /profile/practice-author, click link 'Sign in', fill textbox 'Email' with practice-reader@example.com, fill textbox 'Password' with Practice123, click button 'Sign in'). Read the token from localStorage 'jwtToken'. Make sure practice-reader is not following (DELETE /api/profiles/practice-author/follow with the token). Open /profile/practice-author.
    - expect: Heading 'practice-author' is visible
    - expect: Button 'Follow practice-author' is visible
  2. Check the BEFORE state: send GET /api/profiles/practice-author with header Authorization: Token <token>.
    - expect: Status 200
    - expect: profile.following is false
    - expect: Button 'Unfollow practice-author' is NOT visible
  3. Click button 'Follow practice-author'.
    - expect: Button 'Unfollow practice-author' becomes visible
    - expect: Button 'Follow practice-author' is no longer visible
  4. Check the AFTER state: send GET /api/profiles/practice-author with the same Authorization: Token <token> header.
    - expect: Status 200
    - expect: profile.following is true (it was false before the click)
  5. Cleanup in test.afterEach: send DELETE /api/profiles/practice-author/follow with the practice-reader token so practice-reader is left unfollowed (as the plan assumes).
    - expect: Status 200
    - expect: GET /api/profiles/practice-author now answers following: false

#### 1.2. Signed-in reader unfollows practice-author

**File:** `tests/profile-follow/unfollow.spec.ts`

**Steps:**
  1. Setup: sign in as practice-reader through the sign-in form (same steps as above) and read the token from localStorage 'jwtToken'. Set up by API: POST /api/profiles/practice-author/follow with the token. Open /profile/practice-author.
    - expect: Button 'Unfollow practice-author' is visible
  2. Check the BEFORE state: send GET /api/profiles/practice-author with header Authorization: Token <token>.
    - expect: Status 200
    - expect: profile.following is true
    - expect: Button 'Follow practice-author' is NOT visible
  3. Click button 'Unfollow practice-author'.
    - expect: Button 'Follow practice-author' becomes visible
    - expect: Button 'Unfollow practice-author' is no longer visible
  4. Check the AFTER state: send GET /api/profiles/practice-author with the same Authorization: Token <token> header.
    - expect: Status 200
    - expect: profile.following is false (it was true before the click)
  5. Cleanup in test.afterEach: send DELETE /api/profiles/practice-author/follow with the practice-reader token (safe to repeat) so practice-reader is left unfollowed.
    - expect: GET /api/profiles/practice-author answers following: false
