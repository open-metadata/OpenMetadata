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
import { DOMAIN_TAGS } from '../../../constant/config';
import { TaskClass } from '../../../support/entity/TaskClass';
import {
  createActivityTask,
  expect,
  test,
} from '../../../support/fixtures/taskActivity';
import { redirectToHomePage } from '../../../utils/common';
import { waitForLandingPageWidget } from '../../../utils/customizeLandingPage';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

const MY_TASK_WIDGET_KEY = 'KnowledgePanel.MyTask';

/**
 * The card header renders the task id with its `TASK-` prefix and zero padding
 * stripped, so a test looking for a specific task has to do the same. Matched
 * as an exact string rather than a regex: the rendered text carries a trailing
 * space, which string matching normalizes away and a regex would not.
 */
const cardId = (task: TaskClass) =>
  `#${(task.responseData?.taskId ?? '').replace(/^TASK-0*/, '')}`;

test.describe(
  'My Tasks widget — task status',
  { tag: [DOMAIN_TAGS.DISCOVERY] },
  () => {
    test('lists open tasks and leaves closed ones out', async ({
      page,
      activityData,
    }) => {
      const openTask = await createActivityTask(activityData);
      const closedTask = await createActivityTask(activityData);

      await closedTask.resolve(activityData.apiContext, 'Completed');

      await activityData.member.signIn(page);
      await redirectToHomePage(page);
      await waitForAllLoadersToDisappear(page);

      const widget = await waitForLandingPageWidget(page, MY_TASK_WIDGET_KEY);

      await expect(
        widget.getByText(cardId(openTask), { exact: true })
      ).toBeVisible();

      // Covers the widget's initial fetch end to end: the list is whatever that
      // request returned, so a mount that omits `statusGroup` fails here with
      // the resolved task on screen. Both tasks were created the same way
      // against the same table and assigned to the same team, so status is the
      // only thing keeping this one out.
      await expect(
        widget.getByText(cardId(closedTask), { exact: true })
      ).toBeHidden();
    });
  }
);
