# API review: Claude's first API tests (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you decided and what you saw.

- **App:** Conduit, the practice app on your own laptop (`http://127.0.0.1:3000`)
- **API description:** `P4/API.md`
- **Test file:** `P4/tests/api.spec.ts`, written by Claude
- **Prompt file:** `P4/prompts/api.md`

## 1. My first look, by hand
The request my comment sent in the app, and the status that came back.
- My comment was sent with POST to /api/articles/your-first-end-to-end-test/comments, and the status was 201 Created. The GET comments line after it (200 OK) loads the comments again so the new one shows.

## 2. My predictions and the real answers
One line per request: what I predicted, and what the app really answered.
- **A** (a comment, with the token): I predicted 201. Body: {"comment":{...}} with "body":"Clear and useful." and a new "id" (the author is practice-reader). The app answered 201, comment body "Clear and useful.", id 5, author practice-reader.
- **B** (the same comment, with no token): I predicted 401. Body: {"errors":{"token":["is missing"]}}, because this endpoint needs a token and none was sent. The app answered 401, {"errors":{"token":["is missing"]}}.
- **C** (a comment on an article that does not exist): I predicted 404. Body: {"errors":{"article":["not found"]}}, because the token is fine but no article has the slug no-such-article. The app answered 404, {"errors":{"article":["not found"]}}.
- My answer: All 3 match. One thing to remember from A: the app gave the comment id 5. That number depends on how many comments already exist, so a test shouldn't expect 5. It should read the id from the POST answer and use that, for example to delete the same comment afterwards.

## 3. My prompt to Claude
```text
Task: Write at least 6 Playwright API tests for articles in the Conduit API: create, read, change and delete an article. At least 3 positive and at least 3 negative tests. Save them in P4/tests/api.spec.ts. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. Check the exact status and the key body fields from API.md in every answer (for errors, the exact errors message), and take ids and slugs from the API's own answers, never hard-coded.
```

## 4. The run
- **Result:** 9 tests: 8 passed, 1 failed.
- **A red test, and who is wrong** (only if a test failed): "update: the author changes the title, gets 200, the slug changes and other fields stay". Expected: tagList ["testing","checkout"]. Received: tagList []. API.md says: "Updating: every field is optional. A field you do not send stays as it was."
  My answer: The app is wrong, and the test is right. API.md says: "Updating: every field is optional. A field you do not send stays as it was." The test sends only a new title (line 87), so tagList must stay ['testing', 'checkout']. The app answered "tagList": [], so it removed the tags even though we didn't send tagList. Only an explicit tagList: [] should do that. We keep the test red and report a bug: PUT /api/articles/:slug clears tagList when tagList is not sent.
- **My note** (only if I kept a red test with `test.fail()`): Known app bug: PUT /api/articles/:slug clears tagList when tagList is not sent; API.md says fields not sent stay as they were.

## 5. The developer's question
The test I looked at, and my answer to: "So the app saved nothing, right?"
- **Test:** "create without a title gives 422 "title can't be blank"" (lines 147-158)
- **My answer:** No. The test checks only the answer: status 422 (line 156) and the error message (line 157). It never looks at what the app stored. The app could send 422 and still save an article with no title, and this test would stay green. Claude's "every answer body is compared in full" is true, but it's only about the answer. To know nothing was saved, the test must read the data afterwards, for example with GET /api/articles?author=<the new user's username> (if API.md lists it) and a check that the list is empty (articlesCount 0). The test makes its own new user on line 148, so an empty list is a fair expectation.

## 6. Tests I reviewed with the API checklist
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.

### "create: a signed-in user creates an article and gets 201 with the full article" (lines 53-65)
- **My decision:** Change, because: It passes checklist lines 1 (exact 201), 2 and 3 (line 63 compares the whole answer with toEqual) and 5 (line 54 makes its own user). But the habit says to read the data again after a request that changes data, and this test only trusts the answer. Add a GET after line 64: GET /api/articles/${json.article.slug}, then expect status 200 and the same full article with toEqual({ article: expectedArticle(author.username) }). Then we know the article was really saved, not only reported as created.

## 7. My API rules
The rules I added to my `playwright-quality` skill, under `## API rules`:
1. Check the exact status from API.md and compare the whole answer body with toEqual, including the exact errors message for negative cases.
2. After every request that creates, changes, deletes or is refused, read the data again with a GET and check it: the saved values are there, or nothing changed.
3. Each test makes its own user and data with a unique name, and takes ids and slugs from the API's answers, never hard-coded.
