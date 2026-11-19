import { test, expect } from '@playwright/test';
import { signUp, createArticle, unique, isoDate } from '../helpers/setup';

// API tests for posting and reading comments. Each test makes its own user and article by API.

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

test('a new user posts a comment and reads it back', async ({ request }) => {
  const user = await signUp(request, 'commenter');
  const slug = await createArticle(request, user, toDelete.articles);
  const commentsUrl = `/api/articles/${encodeURIComponent(slug)}/comments`;
  const commentText = unique('Thanks, this checklist helps me. Run ');

  // Before: the new article has no comments.
  const before = await request.get(commentsUrl);
  expect(before.status()).toBe(200);
  expect(await before.json()).toEqual({ comments: [] });

  // Post the comment.
  const posted = await request.post(commentsUrl, {
    headers: { Authorization: `Token ${user.token}` },
    data: { comment: { body: commentText } },
  });
  expect(posted.status()).toBe(201);
  const postedJson = await posted.json();
  // Keep the id from the API's answer for the cleanup, before the check below can fail.
  const id = postedJson.comment?.id;
  if (id !== undefined) toDelete.comments.push({ slug, id, token: user.token });
  expect(postedJson).toEqual({
    comment: {
      id: expect.anything(), // ASSUMPTION: API.md does not say if the id is a number or text.
      createdAt: isoDate,
      updatedAt: isoDate,
      body: commentText,
      // ASSUMPTION: a user does not follow themself, so following is false.
      author: { username: user.username, bio: null, image: null, following: false },
    },
  });

  // After: the list has exactly this one comment, with the same id and text.
  const after = await request.get(commentsUrl);
  expect(after.status()).toBe(200);
  expect(await after.json()).toEqual({
    comments: [
      {
        id,
        createdAt: postedJson.comment.createdAt,
        updatedAt: postedJson.comment.updatedAt,
        body: commentText,
        author: { username: user.username, bio: null, image: null, following: false },
      },
    ],
  });
});

test('posting a comment with no token is refused and saves nothing', async ({ request }) => {
  const user = await signUp(request, 'author');
  const slug = await createArticle(request, user, toDelete.articles);
  const commentsUrl = `/api/articles/${encodeURIComponent(slug)}/comments`;

  // Before: the new article has no comments.
  const before = await request.get(commentsUrl);
  expect(before.status()).toBe(200);
  expect(await before.json()).toEqual({ comments: [] });

  // Post a comment with no Authorization header.
  const refused = await request.post(commentsUrl, {
    data: { comment: { body: unique('A comment with no token. Run ') } },
  });
  expect(refused.status()).toBe(401);
  expect(await refused.json()).toEqual({ errors: { token: ['is missing'] } });

  // After: nothing was saved, the list is still empty.
  const after = await request.get(commentsUrl);
  expect(after.status()).toBe(200);
  expect(await after.json()).toEqual({ comments: [] });
});
