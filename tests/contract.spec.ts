import { test, expect, APIRequestContext } from '@playwright/test';

// Key lists from API.md, sorted A to Z.
const USER_KEYS = ['bio', 'email', 'image', 'token', 'username'];
const ARTICLE_KEYS = [
  'author',
  'body',
  'createdAt',
  'description',
  'favorited',
  'favoritesCount',
  'slug',
  'tagList',
  'title',
  'updatedAt',
];
const PROFILE_KEYS = ['bio', 'following', 'image', 'username'];

// API.md: passwords need at least 8 characters. This one has 12.
const PASSWORD = 'Practice123!';

function uniqueId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

// Signs up a new user with a unique name (API.md: POST /api/users gives 201 User).
async function signUp(request: APIRequestContext, prefix: string) {
  const id = uniqueId();
  const username = `${prefix}-${id}`;
  const email = `${prefix}-${id}@example.com`;
  const response = await request.post('/api/users', {
    data: { user: { username, email, password: PASSWORD } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { username, email, token: json.user.token as string };
}

function auth(token: string) {
  return { Authorization: `Token ${token}` };
}

// Creates an article (API.md: POST /api/articles gives 201 Article).
async function createArticle(request: APIRequestContext, token: string) {
  const article = {
    title: `Contract check ${uniqueId()}`,
    description: 'Short summary of the article',
    body: 'Body text of the article.',
    tagList: ['testing', 'api'],
  };
  const response = await request.post('/api/articles', {
    headers: auth(token),
    data: { article },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { ...article, slug: json.article.slug as string };
}

test.describe('schema', () => {
  test('GET /api/articles/:slug answers with the Article shape from API.md', async ({ request }) => {
    const author = await signUp(request, 'author');
    const created = await createArticle(request, author.token);

    const response = await request.get(`/api/articles/${created.slug}`);

    expect(response.status()).toBe(200);
    const json = await response.json();

    // Types (and the values we sent ourselves).
    expect(json).toMatchObject({
      article: {
        slug: created.slug,
        title: created.title,
        description: created.description,
        body: created.body,
        tagList: created.tagList,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        favorited: expect.any(Boolean),
        favoritesCount: expect.any(Number),
        author: {
          username: author.username,
          // API.md: a new user has bio and image set to null.
          bio: null,
          image: null,
          following: expect.any(Boolean),
        },
      },
    });

    // Exact key lists: no key missing, no extra key.
    expect(Object.keys(json).sort()).toEqual(['article']);
    expect(Object.keys(json.article).sort()).toEqual(ARTICLE_KEYS);
    expect(Object.keys(json.article.author).sort()).toEqual(PROFILE_KEYS);
  });

  test('GET /api/user answers with the User shape from API.md', async ({ request }) => {
    const user = await signUp(request, 'reader');

    const response = await request.get('/api/user', { headers: auth(user.token) });

    expect(response.status()).toBe(200);
    const json = await response.json();

    // Types (and the values we sent ourselves).
    expect(json).toMatchObject({
      user: {
        email: user.email,
        token: expect.any(String),
        username: user.username,
        // API.md: a new user has bio and image set to null.
        bio: null,
        image: null,
      },
    });

    // Exact key lists: no key missing, no extra key.
    expect(Object.keys(json).sort()).toEqual(['user']);
    expect(Object.keys(json.user).sort()).toEqual(USER_KEYS);
  });
});

test.describe('auth', () => {
  test('GET /api/user without a token gives 401 "is missing"', async ({ request }) => {
    const user = await signUp(request, 'reader');

    const response = await request.get('/api/user');

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ errors: { token: ['is missing'] } });

    // Read again with the right token: the user is still there and unchanged.
    const check = await request.get('/api/user', { headers: auth(user.token) });
    expect(check.status()).toBe(200);
    expect((await check.json()).user).toMatchObject({
      email: user.email,
      username: user.username,
      bio: null,
      image: null,
    });
  });

  test('GET /api/user with a wrong token gives 401 "is invalid"', async ({ request }) => {
    const user = await signUp(request, 'reader');

    const response = await request.get('/api/user', {
      headers: auth(`${user.token}-wrong`),
    });

    expect(response.status()).toBe(401);
    // API.md: this app says "is invalid" for a wrong token.
    expect(await response.json()).toEqual({ errors: { token: ['is invalid'] } });

    // Read again with the right token: the user is still there and unchanged.
    const check = await request.get('/api/user', { headers: auth(user.token) });
    expect(check.status()).toBe(200);
    expect((await check.json()).user).toMatchObject({
      email: user.email,
      username: user.username,
      bio: null,
      image: null,
    });
  });

  test("PUT /api/articles/:slug on someone else's article gives 403 and changes nothing", async ({ request }) => {
    const author = await signUp(request, 'author');
    const other = await signUp(request, 'other');
    const created = await createArticle(request, author.token);

    const response = await request.put(`/api/articles/${created.slug}`, {
      headers: auth(other.token),
      data: { article: { title: 'Changed by someone else', body: 'Changed body.' } },
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ errors: { article: ['forbidden'] } });

    // Read again: the article is unchanged and still belongs to the author.
    const check = await request.get(`/api/articles/${created.slug}`);
    expect(check.status()).toBe(200);
    expect((await check.json()).article).toMatchObject({
      slug: created.slug,
      title: created.title,
      description: created.description,
      body: created.body,
      tagList: created.tagList,
      author: { username: author.username },
    });
  });
});
