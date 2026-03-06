/*
 *  Copyright 2025 Collate.
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

import { expect, Page, test as base } from '@playwright/test';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { DataProduct } from '../../../support/domain/DataProduct';
import { Domain } from '../../../support/domain/Domain';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';

const adminUser = new UserClass();
const testUser = new UserClass();
const domain = new Domain();
const dataProduct = new DataProduct([domain]);

let policy: PolicyClass;
let role: RolesClass;

const test = base.extend<{
    page: Page;
    testUserPage: Page;
}>({
    page: async ({ browser }, use) => {
        const adminPage = await browser.newPage();
        try {
            await adminUser.login(adminPage);
            await use(adminPage);
        } finally {
            await adminPage.close();
        }
    },
    testUserPage: async ({ browser }, use) => {
        const userPage = await browser.newPage();
        try {
            await testUser.login(userPage);
            await use(userPage);
        } finally {
            await userPage.close();
        }
    },
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await testUser.create(apiContext);
    await domain.create(apiContext);
    await dataProduct.create(apiContext);

    policy = new PolicyClass();
    await policy.create(apiContext, [
        {
            name: 'DenyViewDomainRule',
            resources: ['domain'],
            operations: ['ViewAll', 'ViewBasic'],
            effect: 'deny',
        },
        {
            name: 'DenyViewDataProductRule',
            resources: ['dataProduct'],
            operations: ['ViewAll', 'ViewBasic'],
            effect: 'deny',
        },
    ]);

    role = new RolesClass();
    await role.create(apiContext, [policy.responseData.name]);

    await testUser.patch({
        apiContext,
        patchData: [
            {
                op: 'replace',
                path: '/roles',
                value: [
                    {
                        id: role.responseData.id,
                        type: 'role',
                        name: role.responseData.name,
                    },
                ],
            },
        ],
    });

    await afterAction();
});

test.describe('Domain and Data Product View Permission Denied', () => {
    test('Domain listing page should show permission error', async ({
        testUserPage,
    }) => {
        await redirectToHomePage(testUserPage);
        await testUserPage.goto('/domain');
        await testUserPage.waitForLoadState('networkidle');

        await expect(
            testUserPage.getByTestId('permission-error-placeholder')
        ).toBeVisible();
    });

    test('Data Product listing page should show permission error', async ({
        testUserPage,
    }) => {
        await redirectToHomePage(testUserPage);
        await testUserPage.goto('/dataProduct');
        await testUserPage.waitForLoadState('networkidle');

        await expect(
            testUserPage.getByTestId('permission-error-placeholder')
        ).toBeVisible();
    });

    test('Domain detail page should show permission error', async ({
        testUserPage,
    }) => {
        const domainFqn = encodeURIComponent(
            domain.responseData.fullyQualifiedName ?? domain.data.name
        );
        await redirectToHomePage(testUserPage);
        await testUserPage.goto(`/domain/${domainFqn}`);
        await testUserPage.waitForLoadState('networkidle');

        await expect(
            testUserPage.getByTestId('permission-error-placeholder')
        ).toBeVisible();
    });

    test('Data Product detail page should show permission error', async ({
        testUserPage,
    }) => {
        const dataProductFqn = encodeURIComponent(
            dataProduct.responseData.fullyQualifiedName ?? dataProduct.data.name
        );
        await redirectToHomePage(testUserPage);
        await testUserPage.goto(`/dataProduct/${dataProductFqn}`);
        await testUserPage.waitForLoadState('networkidle');

        await expect(
            testUserPage.getByTestId('permission-error-placeholder')
        ).toBeVisible();
    });
});

test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    if (role?.responseData?.id) {
        await role.delete(apiContext);
    }
    if (policy?.responseData?.id) {
        await policy.delete(apiContext);
    }

    await dataProduct.delete(apiContext);
    await domain.delete(apiContext);
    await adminUser.delete(apiContext);
    await testUser.delete(apiContext);
    await afterAction();
});