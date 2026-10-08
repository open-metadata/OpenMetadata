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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { expect, test } from '../../../support/fixtures/landingPageUser';
import { redirectToHomePage } from '../../../utils/common';
import {
  LANDING_PAGE_ROOT,
  waitForLandingPageWidget,
} from '../../../utils/customizeLandingPage';

/**
 * The widgets `DEFAULT_LANDING_PAGE_LAYOUT` puts on the page, in its order.
 *
 * Duplicated from `src/constants/CustomizeMyDataPage.constants.ts` on purpose:
 * the point of the check is that the page a user without a customised persona
 * lands on holds all ten cards. Deriving the list from the source would make
 * the test agree with whatever the source says, including when a widget
 * silently stops mounting.
 */
const DEFAULT_LAYOUT_WIDGETS = [
  'KnowledgePanel.PlatformHealth',
  'KnowledgePanel.DataEstate',
  'KnowledgePanel.ActivityFeed',
  'KnowledgePanel.YoursAndFollowed',
  'KnowledgePanel.KnowledgeCenter',
  'KnowledgePanel.CuratedAssets',
  'KnowledgePanel.DataQuality',
  'KnowledgePanel.Domains',
  'KnowledgePanel.DataProducts',
  'KnowledgePanel.KPI',
];

test.describe('Landing page', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await expect(page.getByTestId(LANDING_PAGE_ROOT)).toBeVisible();
  });

  test('renders the page shell and its greeting', async ({ page }) => {
    // The subtitle is the one piece of header copy that is not derived from the
    // signed-in user, so it is the stable thing to assert the header rendered.
    await expect(
      page.getByText("Here's what needs your attention across your data.")
    ).toBeVisible();

    await expect(page.getByTestId('topics-to-catch-up-on')).toBeVisible();
  });

  // The persona layout decides what is on the page; this account's persona has
  // no saved layout, so it is the default one. A widget that stops mounting — a
  // bad key, a throwing hook, an exclusion added downstream — leaves a gap no
  // other spec would notice, because each widget's own spec adds it before
  // asserting.
  test('mounts every widget in the default layout', async ({ page }) => {
    for (const widgetKey of DEFAULT_LAYOUT_WIDGETS) {
      const widget = await waitForLandingPageWidget(page, widgetKey);

      await expect(widget).toBeVisible();
    }
  });

  test('offers the topics view controls', async ({ page }) => {
    const topics = page.getByTestId('topics-to-catch-up-on');

    await expect(topics.getByTestId('toggle-all-widgets')).toBeVisible();
    await expect(topics.getByTestId('topics-grid-view')).toBeVisible();
    await expect(topics.getByTestId('topics-list-view')).toBeVisible();
  });

  test("opens the viewer's persona in the customize page", async ({
    page,
    landingPagePersona,
  }) => {
    const customize = page.getByTestId('customize-home-page');

    await expect(customize).toBeVisible();

    await customize.click();

    // The button edits the persona the page was rendered from, not whichever
    // persona the customize page would default to.
    await expect
      .poll(() => decodeURIComponent(new URL(page.url()).pathname))
      .toBe(
        `/customize-page/${landingPagePersona.responseData.fullyQualifiedName}/LandingPage`
      );
  });

  // Recently viewed moved out of the landing page; it is surfaced by the
  // Context Center dashboard and the app-mode sidebar instead. The rail
  // rendering again would mean the removal was reverted by a merge.
  test('does not render the recently-viewed rail', async ({ page }) => {
    // Anchored on a mounted card first: the absence check alone would pass on
    // a page that had not rendered yet.
    await waitForLandingPageWidget(page, 'KnowledgePanel.PlatformHealth');

    await expect(page.getByTestId('recently-viewed-rail')).toHaveCount(0);
  });
});
