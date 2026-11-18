import { test, expect, APIRequestContext, Page } from '@playwright/test';

// End-to-end tests: the API makes the user, the page does the journey, the API checks the result.

// Dates in answers are ISO 8601 text, for example 2026-01-05T12:00:00.000Z (API.md, Basics).
const isoDate = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);

// A unique text for each run, so the checks can only match what this run made.
const unique = (name: string) => `${name}${Date.now()}${Math.floor(Math.random() * 1000)}`;

// Signs up a new user with the API. Returns the username and token from the API's answer.
async function signUp(request: APIRequestContext, name: string) {
  const username = unique(name);
  const response = await request.post('/api/users', {
    data: { user: { username, email: `${username}@example.com`, password: 'Password123' } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  expect(json.user.username).toBe(username);
  return { username: json.user.username as string, token: json.user.token as string };
}

// Gives the page the user's token. The page keeps it in localStorage under "jwtToken" (app.js).
async function signInPage(page: Page, token: string) {
  await page.addInitScript((t) => localStorage.setItem('jwtToken', t), token);
}

// What each test made, kept from the API's answers, so test.afterEach can delete it even when a check fails.
let toDelete: {
  comments: { slug: string; id: unknown; token: string }[];
  articles: { slug: string; token: string }[];
};

test.beforeEach(() => {
  toDelete = { comments: [], articles: [] };
});

// Cleanup: delete the comments first, then the articles. Soft checks, so every delete runs even if one fails.
test.afterEach(async ({ request }) => {
  for (const c of toDelete.comments) {
    // Only the comment's author may delete it (API.md, Comments).
    const del = await request.delete(`/api/articles/${encodeURIComponent(c.slug)}/comments/${c.id}`, {
      headers: { Authorization: `Token ${c.token}` },
    });
    expect.soft(del.status()).toBe(204);
    const left = await request.get(`/api/articles/${encodeURIComponent(c.slug)}/comments`);
    const leftJson = await left.json();
    expect.soft((leftJson.comments ?? []).map((x: { id: unknown }) => x.id)).not.toContain(c.id);
  }
  for (const a of toDelete.articles) {
    // Only the article's author may delete it (API.md, Articles).
    const del = await request.delete(`/api/articles/${encodeURIComponent(a.slug)}`, {
      headers: { Authorization: `Token ${a.token}` },
    });
    expect.soft(del.status()).toBe(204);
    const gone = await request.get(`/api/articles/${encodeURIComponent(a.slug)}`);
    expect.soft(gone.status()).toBe(404);
    expect.soft(await gone.json()).toEqual({ errors: { article: ['not found'] } });
  }
});

test('a signed-in user publishes a new article in the editor', async ({ page, request }) => {
  const author = await signUp(request, 'writer');
  const article = {
    title: unique('How we test the login page '),
    description: 'Our steps for login testing',
    body: 'First we check the empty form, then a wrong password.',
    tagList: ['testing', 'login'],
  };

  // Before the journey: this new author has no articles.
  const before = await request.get(`/api/articles?author=${encodeURIComponent(author.username)}`);
  expect(before.status()).toBe(200);
  expect(await before.json()).toEqual({ articles: [], articlesCount: 0 });

  // The journey in the page.
  await signInPage(page, author.token);
  await page.goto('/editor');
  await page.getByRole('textbox', { name: 'Title' }).fill(article.title);
  await page.getByRole('textbox', { name: "What's this article about?" }).fill(article.description);
  await page.getByRole('textbox', { name: 'Write your article' }).fill(article.body);
  await page.getByRole('textbox', { name: 'Tags' }).fill('testing, login');
  await page.getByRole('button', { name: 'Publish Article' }).click();

  // The page opens the new article: its title is the main heading.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.title);

  // After the journey: the API has exactly one article by this author, with the values the page sent.
  const list = await request.get(`/api/articles?author=${encodeURIComponent(author.username)}`);
  expect(list.status()).toBe(200);
  const listJson = await list.json();
  // Keep every slug by this author for the cleanup, before the checks below can fail.
  for (const a of listJson.articles ?? []) toDelete.articles.push({ slug: a.slug, token: author.token });
  expect(listJson.articlesCount).toBe(1);
  expect(listJson.articles).toHaveLength(1);
  const slug = listJson.articles[0].slug as string;

  await expect(page).toHaveURL(`/article/${slug}`);

  const saved = await request.get(`/api/articles/${encodeURIComponent(slug)}`);
  expect(saved.status()).toBe(200);
  expect(await saved.json()).toEqual({
    article: {
      slug,
      title: article.title,
      description: article.description,
      body: article.body,
      tagList: article.tagList,
      createdAt: isoDate,
      updatedAt: isoDate,
      favorited: false,
      favoritesCount: 0,
      author: { username: author.username, bio: null, image: null, following: false },
    },
  });
});

test('a signed-in user posts a comment on an article', async ({ page, request }) => {
  // The article is made with the API by one user; a second user comments in the page.
  const author = await signUp(request, 'author');
  const created = await request.post('/api/articles', {
    headers: { Authorization: `Token ${author.token}` },
    data: {
      article: {
        title: unique('Notes on API testing '),
        description: 'What we check in every API test',
        body: 'Status, body, and a GET after every change.',
        tagList: ['testing'],
      },
    },
  });
  expect(created.status()).toBe(201);
  const slug = (await created.json()).article.slug as string;
  toDelete.articles.push({ slug, token: author.token });

  const reader = await signUp(request, 'reader');
  const commentText = unique('Thanks, this checklist helps me. Run ');

  // Before the journey: the article has no comments.
  const before = await request.get(`/api/articles/${encodeURIComponent(slug)}/comments`);
  expect(before.status()).toBe(200);
  expect(await before.json()).toEqual({ comments: [] });

  // The journey in the page.
  await signInPage(page, reader.token);
  await page.goto(`/article/${slug}`);
  await page.getByRole('textbox', { name: 'Write a comment' }).fill(commentText);
  await page.getByRole('button', { name: 'Post Comment' }).click();

  // The page shows the new comment.
  await expect(page.getByText(commentText, { exact: true })).toHaveText(commentText);

  // After the journey: the API has exactly this one comment, with the exact text and author.
  const after = await request.get(`/api/articles/${encodeURIComponent(slug)}/comments`);
  expect(after.status()).toBe(200);
  const afterJson = await after.json();
  // Keep the id of every comment with this run's text for the cleanup, before the check below can fail.
  for (const c of afterJson.comments ?? []) {
    if (c.body === commentText) toDelete.comments.push({ slug, id: c.id, token: reader.token });
  }
  expect(afterJson).toEqual({
    comments: [
      {
        id: expect.anything(), // ASSUMPTION: API.md does not say if the id is a number or text.
        createdAt: isoDate,
        updatedAt: isoDate,
        body: commentText,
        author: { username: reader.username, bio: null, image: null, following: false },
      },
    ],
  });
});
