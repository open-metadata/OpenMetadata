/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { expect, test as base } from '../../support/fixtures/base';
import { performAdminLogin } from '../../utils/admin';

const test = base;
test.use({ storageState: undefined });

const ABOUT_USER = '<#E::user::admin>';
const PROFILE_FEED = '/users/admin/activity_feed/all';

// Browser-side check for the duplicate-id fix: counts the (removed) hardcoded
// id and the (added) per-instance class across every mounted FeedEditor root.
const countRoots = () => {
  const idEls = document.querySelectorAll('#om-quill-editor');
  const classEls = document.querySelectorAll('.feed-editor-root');

  return { idCount: idEls.length, classCount: classEls.length };
};

test.describe('FeedEditor duplicate-id fix (live browser)', () => {
  // Verifies G1 (no om-quill-editor id; feed-editor-root class present), G2
  // (instance-scoped root, not document), and G3-control (the emoji toggle
  // opens then closes cleanly without the bounce the duplicate id caused) on
  // a single FeedEditor mounted inside the activity-feed thread drawer. The
  // two-editor bounce + RTL guarantees are covered by the jsdom regression
  // suite (FeedEditorDuplicateId.test.tsx), which is the environment where the
  // always-on composer + inline-edit co-mount is reliably reachable.
  test('single editor: feed-editor-root class, no om-quill-editor id, emoji toggle closes cleanly', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });

    try {
      const marker = `dup-id-live-${Date.now()}`;
      const conv = await apiContext.post('/api/v1/conversations', {
        data: { message: `${marker} thread`, about: ABOUT_USER },
      });
      const convId = (await conv.json()).id;
      await apiContext.post(`/api/v1/conversations/${convId}/replies`, {
        data: { message: `${marker} reply` },
      });

      await page.goto(PROFILE_FEED, { waitUntil: 'domcontentloaded' });
      await page.reload({ waitUntil: 'domcontentloaded' });

      const threadCard = page
        .getByTestId('message-container')
        .filter({ hasText: `${marker} thread` })
        .filter({ hasNot: page.getByTestId('feed-reply-card') });
      await threadCard.waitFor({ state: 'visible', timeout: 30000 });
      await threadCard.getByTestId('reply-button').click();

      // Hover the reply and open its inline-edit editor (mounts one FeedEditor).
      const replyCard = page
        .getByTestId('feed-reply-card')
        .filter({ hasText: `${marker} reply` });
      await replyCard.waitFor({ state: 'visible', timeout: 20000 });
      await replyCard.hover();
      const editButton = replyCard.getByTestId('edit-message');
      await editButton.waitFor({ state: 'visible', timeout: 10000 });
      await editButton.click();

      const editor = page.getByTestId('editor-wrapper');
      await expect(editor).toBeVisible({ timeout: 20000 });

      // G1: the hardcoded id is gone; the per-instance class is present.
      const counts = await editor.evaluate(countRoots);
      expect(counts.idCount).toBe(0);
      expect(counts.classCount).toBeGreaterThanOrEqual(1);
      await expect(editor).toHaveClass(/feed-editor-root/);

      // G3 (control): the emoji toggle opens then closes without bouncing —
      // the exact gesture the duplicate id broke on the second editor. The
      // fix scopes the toggle/panel queries to the instance root so the
      // close click lands on this editor's own toggle.
      const toggle = editor.locator('.textarea-emoji-control.ql-list');
      await toggle.click();
      await expect(page.locator('#textarea-emoji')).toBeVisible({
        timeout: 10000,
      });
      await toggle.click();
      await expect(page.locator('#textarea-emoji')).toHaveCount(0, {
        timeout: 10000,
      });
    } finally {
      await afterAction();
    }
  });
});
