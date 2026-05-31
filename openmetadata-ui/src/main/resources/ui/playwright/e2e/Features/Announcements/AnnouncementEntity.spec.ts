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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  limitations under the License.
 */

import test from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import { selectDomain } from '../../../utils/domain';
import {
  createAnnouncement,
  deleteAnnouncement,
  editAnnouncement,
} from '../../../utils/entity';
import { sidebarClick } from '../../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const createSeedAnnouncement = async (
  apiContext: Awaited<ReturnType<typeof getApiContext>>['apiContext'],
  domain: Domain,
  title: string,
  description: string
) => {
  const now = Date.now();

  const response = await apiContext.post('/api/v1/announcements', {
    data: {
      displayName: title,
      description,
      entityLink: `<#E::domain::${domain.responseData.fullyQualifiedName}>`,
      startTime: now,
      endTime: now + 5 * 24 * 60 * 60 * 1000,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to seed announcement: ${response.status()} ${await response.text()}`
    );
  }
};

const visitDomainPage = async (
  page: Parameters<typeof test>[0]['page'],
  domain: Domain
) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.DOMAIN);
  await selectDomain(page, domain.responseData);
};

test.describe.serial('Announcement Entity Lifecycle', () => {
  test('creates an announcement on a domain', async ({ page }) => {
    test.setTimeout(120000);
    const domain = new Domain();
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      await domain.create(apiContext);
      await visitDomainPage(page, domain);

      await createAnnouncement(
        page,
        {
          title: 'Domain Announcement Test',
          description: 'Domain Announcement Description',
        },
        false
      );
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('edits an existing announcement on a domain', async ({ page }) => {
    test.setTimeout(120000);
    const domain = new Domain();
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      await domain.create(apiContext);
      await createSeedAnnouncement(
        apiContext,
        domain,
        'Seeded Domain Announcement',
        'Seeded Domain Announcement Description'
      );
      await visitDomainPage(page, domain);

      await editAnnouncement(page, {
        title: 'Edited Domain Announcement',
        description: 'Updated Domain Announcement Description',
      });
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('deletes an existing announcement on a domain', async ({ page }) => {
    test.setTimeout(120000);
    const domain = new Domain();
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      await domain.create(apiContext);
      await createSeedAnnouncement(
        apiContext,
        domain,
        'Delete Domain Announcement',
        'Delete Domain Announcement Description'
      );
      await visitDomainPage(page, domain);

      await deleteAnnouncement(page);
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});
