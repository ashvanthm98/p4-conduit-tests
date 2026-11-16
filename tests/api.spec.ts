import { test, expect, APIRequestContext } from '@playwright/test';

// Dates in answers are ISO 8601 text, for example 2026-01-05T12:00:00.000Z (API.md, Basics).
const isoDate = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);

// Signs up a new user, so every test has its own author. Returns the username and token from the API's answer.
async function signUp(request: APIRequestContext, name: string) {
  const unique = `${name}${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const response = await request.post('/api/users', {
    data: { user: { username: unique, email: `${unique}@example.com`, password: 'Password123' } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  expect(json.user.username).toBe(unique);
  return { username: json.user.username as string, token: json.user.token as string };
}

// Creates an article and returns the full answer body. The slug comes from this answer.
async function createArticle(request: APIRequestContext, token: string, article: object) {
  const response = await request.post('/api/articles', {
    headers: { Authorization: `Token ${token}` },
    data: { article },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

const newArticle = {
  title: 'How we test the checkout page',
  description: 'Our steps for checkout testing',
  body: 'First we check the cart, then the payment.',
  tagList: ['testing', 'checkout'],
};

// The full Article we expect for newArticle, written by this author (API.md, Articles).
function expectedArticle(username: string, fields = newArticle) {
  return {
    slug: expect.any(String),
    title: fields.title,
    description: fields.description,
    body: fields.body,
    tagList: fields.tagList,
    createdAt: isoDate,
    updatedAt: isoDate,
    favorited: false,
    favoritesCount: 0,
    author: { username, bio: null, image: null, following: false },
  };
}

// ---------- Positive tests ----------

test('create: a signed-in user creates an article and gets 201 with the full article', async ({ request }) => {
  const author = await signUp(request, 'creator');

  const response = await request.post('/api/articles', {
    headers: { Authorization: `Token ${author.token}` },
    data: { article: newArticle },
  });

  expect(response.status()).toBe(201);
  const json = await response.json();
  expect(json).toEqual({ article: expectedArticle(author.username) });
  expect(json.article.slug).not.toBe('');
});

test('read: GET by slug returns 200 with the same article that was created', async ({ request }) => {
  const author = await signUp(request, 'reader');
  const created = await createArticle(request, author.token, newArticle);
  const slug = created.article.slug;

  const response = await request.get(`/api/articles/${slug}`);

  expect(response.status()).toBe(200);
  const json = await response.json();
  expect(json).toEqual({ article: { ...expectedArticle(author.username), slug } });
  expect(json.article.createdAt).toBe(created.article.createdAt);
});

test('update: the author changes the title, gets 200, the slug changes and other fields stay', async ({ request }) => {
  // Known app bug: PUT /api/articles/:slug clears tagList when tagList is not sent; API.md says fields not sent stay as they were.
  test.fail();
  const author = await signUp(request, 'editor');
  const created = await createArticle(request, author.token, newArticle);
  const oldSlug = created.article.slug;

  const response = await request.put(`/api/articles/${oldSlug}`, {
    headers: { Authorization: `Token ${author.token}` },
    data: { article: { title: 'How we test the payment page' } },
  });

  expect(response.status()).toBe(200);
  const json = await response.json();
  expect(json).toEqual({
    article: expectedArticle(author.username, { ...newArticle, title: 'How we test the payment page' }),
  });
  // This app: when the title changes, the slug changes too.
  expect(json.article.slug).not.toBe(oldSlug);
  expect(json.article.createdAt).toBe(created.article.createdAt);

  // The change is saved: reading the new slug gives the new title.
  const readBack = await request.get(`/api/articles/${json.article.slug}`);
  expect(readBack.status()).toBe(200);
  expect((await readBack.json()).article.title).toBe('How we test the payment page');
});

test('delete: the author deletes the article, gets 204 with no body, and the article is gone', async ({ request }) => {
  const author = await signUp(request, 'remover');
  const created = await createArticle(request, author.token, newArticle);
  const slug = created.article.slug;

  const response = await request.delete(`/api/articles/${slug}`, {
    headers: { Authorization: `Token ${author.token}` },
  });

  expect(response.status()).toBe(204);
  expect(await response.text()).toBe('');

  const readBack = await request.get(`/api/articles/${slug}`);
  expect(readBack.status()).toBe(404);
  expect(await readBack.json()).toEqual({ errors: { article: ['not found'] } });
});

// ---------- Negative tests ----------

test('create without a token gives 401 "token is missing"', async ({ request }) => {
  const response = await request.post('/api/articles', {
    data: { article: newArticle },
  });

  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ errors: { token: ['is missing'] } });
});

test('create with a wrong token gives 401 "token is invalid"', async ({ request }) => {
  const author = await signUp(request, 'badtoken');

  const response = await request.post('/api/articles', {
    headers: { Authorization: `Token ${author.token}wrong` },
    data: { article: newArticle },
  });

  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ errors: { token: ['is invalid'] } });
});

test('create without a title gives 422 "title can\'t be blank"', async ({ request }) => {
  const author = await signUp(request, 'notitle');
  const { title, ...withoutTitle } = newArticle;

  const response = await request.post('/api/articles', {
    headers: { Authorization: `Token ${author.token}` },
    data: { article: withoutTitle },
  });

  expect(response.status()).toBe(422);
  expect(await response.json()).toEqual({ errors: { title: ["can't be blank"] } });
});

test('update by a user who is not the author gives 403 "article forbidden" and the article does not change', async ({ request }) => {
  const author = await signUp(request, 'owner');
  const other = await signUp(request, 'stranger');
  const created = await createArticle(request, author.token, newArticle);
  const slug = created.article.slug;

  const response = await request.put(`/api/articles/${slug}`, {
    headers: { Authorization: `Token ${other.token}` },
    data: { article: { title: 'Changed by someone else' } },
  });

  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ errors: { article: ['forbidden'] } });

  const readBack = await request.get(`/api/articles/${slug}`);
  expect(readBack.status()).toBe(200);
  expect(await readBack.json()).toEqual({ article: { ...expectedArticle(author.username), slug } });
});

test('delete an article that was already deleted gives 404 "article not found"', async ({ request }) => {
  const author = await signUp(request, 'twice');
  const created = await createArticle(request, author.token, newArticle);
  const slug = created.article.slug;
  const first = await request.delete(`/api/articles/${slug}`, {
    headers: { Authorization: `Token ${author.token}` },
  });
  expect(first.status()).toBe(204);

  const response = await request.delete(`/api/articles/${slug}`, {
    headers: { Authorization: `Token ${author.token}` },
  });

  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ errors: { article: ['not found'] } });
});
