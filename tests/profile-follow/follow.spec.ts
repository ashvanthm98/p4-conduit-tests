// spec: specs/profile-follow.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';
import { signUp, signInPage } from '../../helpers/setup';
import { ProfilePage } from '../../pages/profile-page';

test.describe('Profile page and following', () => {
  // Shared with afterEach so the cleanup can unfollow.
  let reader: { username: string; token: string } | null = null;
  let author: { username: string; token: string } | null = null;

  test.afterEach(async ({ request }) => {
    // 5. Cleanup: leave the reader unfollowed.
    if (!reader || !author) return;
    const response = await request.delete(
      `/api/profiles/${encodeURIComponent(author.username)}/follow`,
      { headers: { Authorization: `Token ${reader.token}` } },
    );
    expect(response.status()).toBe(200);
  });

  test('Signed-in reader follows a new author', async ({ page, request }) => {
    reader = null;
    author = null;

    // 1. Setup: sign up a new reader and a new author by API, give the page the reader's token
    author = await signUp(request, 'author');
    reader = await signUp(request, 'reader');
    const headers = { Authorization: `Token ${reader.token}` };
    const profileUrl = `/api/profiles/${encodeURIComponent(author.username)}`;

    await signInPage(page, reader.token);
    const profile = new ProfilePage(page);
    await profile.goto(author.username);
    await expect(profile.heading).toHaveText(author.username);

    // 2. Check the BEFORE state
    const before = await request.get(profileUrl, { headers });
    expect(before.status()).toBe(200);
    // Only the follow part is checked here; the exact profile shape is checked in its own test below.
    expect((await before.json()).profile.following).toBe(false);
    await expect(profile.unfollowButton(author.username)).toHaveCount(0);
    // ASSUMPTION: the button's visible text is the same as its accessible name.
    await expect(profile.followButton(author.username)).toHaveText(`Follow ${author.username}`);

    // 3. Click button "Follow <author>"
    await profile.followButton(author.username).click();

    // 4. Check the AFTER state
    // ASSUMPTION: the button's visible text is the same as its accessible name.
    await expect(profile.unfollowButton(author.username)).toHaveText(`Unfollow ${author.username}`);
    await expect(profile.followButton(author.username)).toHaveCount(0);

    const after = await request.get(profileUrl, { headers });
    expect(after.status()).toBe(200);
    expect((await after.json()).profile.following).toBe(true);
  });
});

test('GET /api/profiles/:username gives exactly the Profile fields from API.md', async ({ request }) => {
  // Known app bug: the profile answer has an extra "email" field (an email leak); API.md's Profile is
  // exactly username, bio, image, following. When the app stops sending email, this test turns red: remove test.fail().
  test.fail();
  const author = await signUp(request, 'author');
  const reader = await signUp(request, 'reader');

  const response = await request.get(`/api/profiles/${encodeURIComponent(author.username)}`, {
    headers: { Authorization: `Token ${reader.token}` },
  });

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    profile: { username: author.username, bio: null, image: null, following: false },
  });
});
