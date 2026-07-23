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

/**
 * Domain analogue of {@code GlossaryRenamePrefixCascade.spec.ts} (issue #28696).
 * A prefix-extension rename — new name keeps the old name as a prefix
 * (e.g. "sales" -> "sales global") — must keep every linked asset's
 * {@code domains[].fullyQualifiedName} pointing at the new FQN in search, with
 * no double-suffixed FQN.
 *
 * <p>The domain FQN-prefix scripts are already boundary-aware
 * (`fqn.equals(oldFqn) || fqn.startsWith(oldFqn + '.')`), so domains never had
 * the glossary double-apply; this spec locks that contract in from the UI/API
 * surface. The domain name is kept dot-free so its FQN is unquoted and the new
 * FQN literally startsWith the old one.
 */

import test, { expect } from '@playwright/test';
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage, uuid } from '../../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

test('domain prefix rename keeps linked asset domain reference consistent', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { apiContext, afterAction } = await createNewPage(browser);

  const table = new TableClass();
  const id = uuid();
  // Dot-free name so the FQN is unquoted and the new FQN startsWith the old one.
  const domain = new Domain({
    name: `pw_dom_${id}`,
    displayName: `PW Domain ${id}`,
    description: 'prefix-rename domain search regression (#28696)',
    domainType: 'Aggregate',
    fullyQualifiedName: `pw_dom_${id}`,
  });

  try {
    await domain.create(apiContext);
    await table.create(apiContext);

    const originalDomainFqn = domain.responseData.fullyQualifiedName as string;
    const tableFqn = table.entityResponseData.fullyQualifiedName as string;

    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: domain.responseData.id,
            type: 'domain',
            name: domain.responseData.name,
            fullyQualifiedName: originalDomainFqn,
          },
        },
      ],
    });

    await assertAssetDomain({
      apiContext,
      tableFqn,
      expectedDomainFqn: originalDomainFqn,
      label: 'pre-rename',
    });

    await domain.patch({
      apiContext,
      patchData: [
        {
          op: 'replace',
          path: '/name',
          value: `${domain.responseData.name} Renamed`,
        },
        {
          op: 'replace',
          path: '/displayName',
          value: 'Customer Domain Renamed',
        },
      ],
    });

    const newDomainFqn = domain.responseData.fullyQualifiedName as string;
    expect(newDomainFqn).not.toBe(originalDomainFqn);
    expect(newDomainFqn.startsWith(originalDomainFqn)).toBe(true);

    await assertAssetDomain({
      apiContext,
      tableFqn,
      expectedDomainFqn: newDomainFqn,
      label: 'post-prefix-rename',
    });
  } finally {
    await table.delete(apiContext);
    await domain.delete(apiContext);
    await afterAction();
  }
});

async function assertAssetDomain(opts: {
  apiContext: import('@playwright/test').APIRequestContext;
  tableFqn: string;
  expectedDomainFqn: string;
  label: string;
}): Promise<void> {
  const { apiContext, tableFqn, expectedDomainFqn, label } = opts;

  await expect
    .poll(
      async () => {
        const res = await apiContext.get(
          `/api/v1/search/query?q=fullyQualifiedName:%22${encodeURIComponent(
            tableFqn
          )}%22&index=table_search_index`
        );
        if (res.status() !== 200) {
          return undefined;
        }
        const body = await res.json();
        const source = body?.hits?.hits?.[0]?._source;
        if (!source) {
          return undefined;
        }

        const domainFqns = (source.domains ?? []).map(
          (d: { fullyQualifiedName?: string }) => d.fullyQualifiedName
        );

        return {
          hasExactDomain: domainFqns.includes(expectedDomainFqn),
          noDuplicatedFqn: !domainFqns.some(
            (fqn: string) =>
              fqn !== expectedDomainFqn && fqn.startsWith(expectedDomainFqn)
          ),
        };
      },
      {
        message: `${label}: the linked asset must carry domain FQN "${expectedDomainFqn}" with no double-suffixed FQN`,
        timeout: 60_000,
      }
    )
    .toEqual({
      hasExactDomain: true,
      noDuplicatedFqn: true,
    });
}
