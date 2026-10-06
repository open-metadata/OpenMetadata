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
import { expect } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { redirectToHomePage } from '../../utils/common';
import { waitForLandingPageWidget } from '../../utils/customizeLandingPage';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

// `TopicKey` in src/components/MyData/Widgets/Common/TopicWidget/topics.types.ts.
// The card's own testid is keyed by topic; the grid cell holding it is keyed by
// the layout key, which is what `waitForLandingPageWidget` reveals.
const TEAM_ACTIVITY = {
  layoutKey: 'KnowledgePanel.ActivityFeed',
  topicKey: 'teamActivity',
};
const DATA_ESTATE = {
  layoutKey: 'KnowledgePanel.DataEstate',
  topicKey: 'dataEstate',
};

test.describe(
  'Landing page topic widgets',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await waitForAllLoadersToDisappear(page);
    });

    test('renders the Topics section and its cards', async ({ page }) => {
      await expect(page.getByTestId('topics-to-catch-up-on')).toBeVisible();

      await waitForLandingPageWidget(page, TEAM_ACTIVITY.layoutKey);

      await expect(
        page.getByTestId(`topic-card-${TEAM_ACTIVITY.topicKey}`)
      ).toBeVisible();
    });

    // The whole header strip is the control, not just the chevron -- a card is
    // otherwise inert and the header is what a reader aims at.
    test('collapsing a card from its header hides the body and keeps the title', async ({
      page,
    }) => {
      await waitForLandingPageWidget(page, TEAM_ACTIVITY.layoutKey);

      const card = page.getByTestId(`topic-card-${TEAM_ACTIVITY.topicKey}`);
      const toggle = card.getByTestId(
        `toggle-widget-${TEAM_ACTIVITY.layoutKey}`
      );
      const footerAction = card.getByTestId(
        `topic-action-${TEAM_ACTIVITY.topicKey}`
      );

      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(footerAction).toBeVisible();

      await toggle.click();

      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(footerAction).toBeHidden();
      // The header survives so the collapsed card is still identifiable.
      await expect(toggle).toBeVisible();

      await toggle.click();

      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(footerAction).toBeVisible();
    });

    test('Collapse all closes every card and flips to Expand all', async ({
      page,
    }) => {
      await waitForLandingPageWidget(page, TEAM_ACTIVITY.layoutKey);
      await waitForLandingPageWidget(page, DATA_ESTATE.layoutKey);

      const toggleAll = page.getByTestId('toggle-all-widgets');
      const activityToggle = page.getByTestId(
        `toggle-widget-${TEAM_ACTIVITY.layoutKey}`
      );
      const estateToggle = page.getByTestId(
        `toggle-widget-${DATA_ESTATE.layoutKey}`
      );

      await toggleAll.click();

      await expect(activityToggle).toHaveAttribute('aria-expanded', 'false');
      await expect(estateToggle).toHaveAttribute('aria-expanded', 'false');

      await toggleAll.click();

      await expect(activityToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(estateToggle).toHaveAttribute('aria-expanded', 'true');
    });

    test('list view stacks the cards into a single column', async ({
      page,
    }) => {
      await waitForLandingPageWidget(page, TEAM_ACTIVITY.layoutKey);
      await waitForLandingPageWidget(page, DATA_ESTATE.layoutKey);

      const activityCell = page.getByTestId(TEAM_ACTIVITY.layoutKey);
      const estateCell = page.getByTestId(DATA_ESTATE.layoutKey);

      // Grid: the two cards share a row, so their left edges differ.
      const gridActivity = await activityCell.boundingBox();
      const gridEstate = await estateCell.boundingBox();

      expect(gridActivity?.x).not.toBe(gridEstate?.x);

      await page.getByTestId('topics-list-view').click();

      await expect
        .poll(async () => {
          const listActivity = await activityCell.boundingBox();
          const listEstate = await estateCell.boundingBox();

          return listActivity && listEstate
            ? Math.round(listActivity.x) === Math.round(listEstate.x)
            : false;
        })
        .toBe(true);

      await page.getByTestId('topics-grid-view').click();

      await expect
        .poll(async () => {
          const back = await activityCell.boundingBox();
          const backEstate = await estateCell.boundingBox();

          return back && backEstate
            ? Math.round(back.x) !== Math.round(backEstate.x)
            : false;
        })
        .toBe(true);
    });
  }
);
