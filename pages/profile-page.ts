import { Page, Locator } from '@playwright/test';

// The profile page: /profile/:username
export class ProfilePage {
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    // The profile's username is the main heading.
    this.heading = page.getByRole('heading', { level: 1 });
  }

  async goto(username: string) {
    await this.page.goto(`/profile/${encodeURIComponent(username)}`);
  }

  // "Follow" is a substring of "Unfollow", so exact: true is used
  followButton(username: string): Locator {
    return this.page.getByRole('button', { name: `Follow ${username}`, exact: true });
  }

  unfollowButton(username: string): Locator {
    return this.page.getByRole('button', { name: `Unfollow ${username}`, exact: true });
  }
}
