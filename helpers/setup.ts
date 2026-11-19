import { expect, APIRequestContext, Page } from '@playwright/test';

// Shared setup for the tests: the API makes the users and the data (same style as tests/e2e.spec.ts).

// Dates in answers are ISO 8601 text, for example 2026-01-05T12:00:00.000Z (API.md, Basics).
export const isoDate = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);

// A unique text for each run, so the checks can only match what this run made.
export const unique = (name: string) => `${name}${Date.now()}${Math.floor(Math.random() * 1000)}`;

// Signs up a new user with the API and checks the answer, including that the token works.
// Returns the username and token from the API's answer.
export async function signUp(request: APIRequestContext, name: string) {
  const username = unique(name);
  const email = `${username}@example.com`;
  const response = await request.post('/api/users', {
    data: { user: { username, email, password: 'Password123' } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  // A new user has bio and image set to null (API.md, Users and sign-in).
  expect(json).toEqual({
    user: { email, token: expect.any(String), username, bio: null, image: null },
  });

  // Check the token from the sign-up answer: GET /api/user with it gives back this same user.
  const me = await request.get('/api/user', {
    headers: { Authorization: `Token ${json.user.token}` },
  });
  expect(me.status()).toBe(200);
  expect(await me.json()).toEqual({
    // ASSUMPTION: API.md does not say if GET /api/user gives the same token or a new one.
    user: { email, token: expect.any(String), username, bio: null, image: null },
  });

  return { username: json.user.username as string, token: json.user.token as string };
}

// Gives the page the user's token. The page keeps it in localStorage under "jwtToken".
export async function signInPage(page: Page, token: string) {
  await page.addInitScript((t) => localStorage.setItem('jwtToken', t), token);
}

// Makes an article with the API, checks the answer and reads it back with a GET.
// Adds the slug to the cleanup list before any check can fail. Returns the slug from the API's answer.
export async function createArticle(
  request: APIRequestContext,
  author: { username: string; token: string },
  cleanup: { slug: string; token: string }[],
) {
  const article = {
    title: unique('Notes on API testing '),
    description: 'What we check in every API test',
    body: 'Status, body, and a GET after every change.',
    tagList: ['testing'],
  };
  const created = await request.post('/api/articles', {
    headers: { Authorization: `Token ${author.token}` },
    data: { article },
  });
  expect(created.status()).toBe(201);
  const json = await created.json();
  const slug = json.article?.slug as string;
  if (slug) cleanup.push({ slug, token: author.token });

  const expected = {
    article: {
      slug,
      ...article,
      createdAt: isoDate,
      updatedAt: isoDate,
      favorited: false,
      favoritesCount: 0,
      author: { username: author.username, bio: null, image: null, following: false },
    },
  };
  expect(json).toEqual(expected);

  const saved = await request.get(`/api/articles/${encodeURIComponent(slug)}`);
  expect(saved.status()).toBe(200);
  expect(await saved.json()).toEqual(expected);

  return slug;
}
