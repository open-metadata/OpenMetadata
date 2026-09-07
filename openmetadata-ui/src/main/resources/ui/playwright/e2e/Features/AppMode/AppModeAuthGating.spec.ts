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

import { APIRequestContext } from '@playwright/test';
import { expect, test } from '../../../support/fixtures/base';
import { UserClass } from '../../../support/user/UserClass';
import { createNewPage, getApiContext } from '../../../utils/common';
import { withAppConfigLock } from '../../Utils/appConfigMutex';

/**
 * Pure API-level authz coverage for the preferences surface
 * (`UserResource#authorizeSelfOrAdmin`) and the tenant-wide
 * `appConfiguration` settings write (`SystemResource#createOrUpdateSetting`,
 * unconditional `authorizer.authorizeAdmin`). No UI interaction is needed
 * beyond the one-time login each fixture user does to mint its own
 * `APIRequestContext` — see `getApiContext` usage below, the codebase's
 * established pattern for "make a REST call as a specific already-logged-in
 * identity" (Node-side `APIRequestContext` built from that page's bearer
 * token, not a raw `request.newContext()` with duplicated token logic).
 */
const userA = new UserClass();
const userB = new UserClass();

let userAApiContext: APIRequestContext;
let userBApiContext: APIRequestContext;
let disposeUserAContext: () => Promise<void>;
let disposeUserBContext: () => Promise<void>;

test.beforeAll(
  'Create fixture users and per-user API contexts',
  async ({ browser }) => {
    const { apiContext: adminApiContext, afterAction: adminAfterAction } =
      await createNewPage(browser);
    await userA.create(adminApiContext);
    await userB.create(adminApiContext);
    await adminAfterAction();

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await userA.login(pageA);
    const resultA = await getApiContext(pageA);
    userAApiContext = resultA.apiContext;
    disposeUserAContext = async () => {
      await resultA.afterAction();
      await contextA.close();
    };

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await userB.login(pageB);
    const resultB = await getApiContext(pageB);
    userBApiContext = resultB.apiContext;
    disposeUserBContext = async () => {
      await resultB.afterAction();
      await contextB.close();
    };
  }
);

test.afterAll('Cleanup fixture users', async ({ browser }) => {
  await disposeUserAContext?.();
  await disposeUserBContext?.();

  const { apiContext, afterAction } = await createNewPage(browser);
  await userA.delete(apiContext).catch(() => undefined);
  await userB.delete(apiContext).catch(() => undefined);
  await afterAction();
});

test.describe('AppMode — authz gating', () => {
  test.afterEach(async () => {
    // Best-effort: whichever of the two users' own preference a test wrote
    // to, clear it so the next test starts clean.
    await userAApiContext
      .delete(`/api/v1/users/${userA.responseData.id}/preferences/appMode`)
      .catch(() => undefined);
    await userBApiContext
      .delete(`/api/v1/users/${userB.responseData.id}/preferences/appMode`)
      .catch(() => undefined);
  });

  test('User A can PUT their own preference', async () => {
    const response = await userAApiContext.put(
      `/api/v1/users/${userA.responseData.id}/preferences/appMode`,
      { data: { type: 'appMode', config: { value: 'ai' } } }
    );

    expect(response.status()).toBe(200);
  });

  test('User A can DELETE their own preference', async () => {
    await userAApiContext.put(
      `/api/v1/users/${userA.responseData.id}/preferences/appMode`,
      { data: { type: 'appMode', config: { value: 'ai' } } }
    );

    const response = await userAApiContext.delete(
      `/api/v1/users/${userA.responseData.id}/preferences/appMode`
    );

    expect(response.status()).toBe(200);
  });

  test("User A cannot PUT user B's preference", async () => {
    const response = await userAApiContext.put(
      `/api/v1/users/${userB.responseData.id}/preferences/appMode`,
      { data: { type: 'appMode', config: { value: 'ai' } } }
    );

    expect(response.status()).toBe(403);
  });

  test("User A cannot DELETE user B's preference", async () => {
    const response = await userAApiContext.delete(
      `/api/v1/users/${userB.responseData.id}/preferences/appMode`
    );

    expect(response.status()).toBe(403);
  });

  test("User A cannot GET user B's preferences", async () => {
    const response = await userAApiContext.get(
      `/api/v1/users/${userB.responseData.id}/preferences`
    );

    expect(response.status()).toBe(403);
  });

  test("Admin can PUT any user's preference", async ({ browser }) => {
    const { apiContext: adminApiContext, afterAction } = await createNewPage(
      browser
    );
    const response = await adminApiContext.put(
      `/api/v1/users/${userB.responseData.id}/preferences/appMode`,
      { data: { type: 'appMode', config: { value: 'classic' } } }
    );

    expect(response.status()).toBe(200);

    await afterAction();
  });

  test('Non-admin cannot PUT /system/settings with configType appConfiguration', async () => {
    const response = await userAApiContext.put('/api/v1/system/settings', {
      data: {
        config_type: 'appConfiguration',
        // Never written: this PUT is rejected with 403, so 'ai' never reaches
        // the global row.
        config_value: { defaultAppMode: 'ai' },
      },
    });

    expect(response.status()).toBe(403);
  });

  test('Admin can PUT /system/settings with configType appConfiguration', async ({
    browser,
  }) => {
    const { apiContext: adminApiContext, afterAction } = await createNewPage(
      browser
    );
    // The whole read-modify-restore runs under the cross-worker mutex.
    // `AppModeSettings.spec.ts` does real, mutex-guarded writes to this same
    // global row. Unlocked, this test could capture one of that spec's
    // intermediate values as `original` and restore it as the baseline —
    // pinning the row non-null indefinitely — or land its own write inside
    // that spec's critical section and flake its read-back assertions.
    // Reading `original` must be inside the lock too: that is the read that
    // would otherwise observe a mid-flight value.
    try {
      await withAppConfigLock(async () => {
        const before = await adminApiContext.get(
          '/api/v1/system/settings/appConfiguration'
        );
        const beforeBody = await before.json();
        const original = beforeBody?.config_value?.defaultAppMode ?? null;

        try {
          const response = await adminApiContext.put(
            '/api/v1/system/settings',
            {
              data: {
                config_type: 'appConfiguration',
                // 'classic', not 'ai' — this is a real write to a global row
                // that every context reads at boot. The assertion is on the
                // status code, so the value is arbitrary; 'ai' would briefly
                // boot other specs into the AI shell.
                config_value: { defaultAppMode: 'classic' },
              },
            }
          );

          expect(response.status()).toBe(200);
        } finally {
          // Never leave the tenant setting mutated for later spec files.
          await adminApiContext.put('/api/v1/system/settings', {
            data: {
              config_type: 'appConfiguration',
              config_value: { defaultAppMode: original },
            },
          });
        }
      });
    } finally {
      await afterAction();
    }
  });
});
