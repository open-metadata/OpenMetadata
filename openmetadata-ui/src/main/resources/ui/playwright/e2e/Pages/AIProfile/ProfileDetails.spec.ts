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
import {
  APIRequestContext,
  Browser,
  expect,
  Locator,
  mergeTests,
  Page,
  Response,
} from '@playwright/test';
import {
  PolicyClass,
  PolicyRulesType,
} from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { Domain } from '../../../support/domain/Domain';
import { test as isolatedUserTest } from '../../../support/fixtures/isolatedUser';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { TeamClass } from '../../../support/team/TeamClass';
import { UserClass } from '../../../support/user/UserClass';
import { createAdminApiContext } from '../../../utils/admin';
import { deleteFixtureEntity, settleAll } from '../../../utils/apiResponse';
import {
  AI_SHELL_TIMEOUT,
  visitInbox,
  visitMyData,
} from '../../../utils/inbox';
import {
  assignChip,
  closeProfileModal,
  fillChangePasswordForm,
  fillPasswordField,
  getChipRemoveButton,
  gotoPersonalSpace,
  openChangePasswordForm,
  openProfileModal,
  PERSONAL_SPACE_ROUTES,
  personasSearchResponse,
  removeChip,
  rolesSearchResponse,
  submitChangePassword,
  visitProfile,
  waitForListboxOption,
} from '../../../utils/personalSpace';
import { waitForSearchIndexed } from '../../../utils/polling';
import { performUserLogin } from '../../../utils/user';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { test as pagesTest } from '../../fixtures/pages';

// `page`/`viewOnlyPage` for the read-only checks; `freshUserPage` for tests that
// change their own account (tokens, password), so the fixture owns its lifecycle.
const test = mergeTests(pagesTest, isolatedUserTest);

test.use({ storageState: 'playwright/.auth/admin.json' });

const PROFILE_TAGS = { tag: ['@Platform', '@Features'] };

// Two entities per multi-select row so the lifecycle test can assign one, swap
// to the other ("change"), then remove — all through the UI, all starting from
// an unassigned state (nothing is pre-patched onto the user for these rows).
const personaA = new PersonaClass();
const personaB = new PersonaClass();
const domainA = new Domain();
const domainB = new Domain();
const teamA = new TeamClass();
const teamB = new TeamClass();
const roleAPolicy = new PolicyClass();
const roleA = new RolesClass();
const roleBPolicy = new PolicyClass();
const roleB = new RolesClass();
// A domain pre-assigned to the user, used only by the cancel test so it stays
// independent of the lifecycle tests (which only touch domainA/domainB).
const cancelDomain = new Domain();
// A dedicated admin owns the profile assignments under test so the shared
// storageState user is never edited (no edit/delete on shared assets). Each
// test touches a distinct field, keeping them order-independent.
const profileAdmin = new UserClass();
// A second dedicated admin for the persistence suite, so its assign/close/reopen
// round-trips never race the lifecycle suite's edits on `profileAdmin`.
const persistAdmin = new UserClass();

// Best-effort hard delete: skips a fixture whose create never returned, and
// tolerates one already gone, so one failure cannot leak the rest.
const deleteFixture = async (
  apiContext: APIRequestContext,
  collection: string,
  id: string | undefined
) => {
  if (id) {
    await deleteFixtureEntity(
      apiContext,
      `/api/v1/${collection}/${id}?hardDelete=true&recursive=true`
    );
  }
};

// Log in as `user` in a clean context (the file's admin storageState would
// otherwise leak into browser.newPage()) and open its Profile modal.
const onUserProfile = async (
  browser: Browser,
  user: UserClass,
  run: (page: Page) => Promise<void>,
  nav?: string
) => {
  const { page, afterAction } = await performUserLogin(browser, user);
  try {
    await visitProfile(page, nav);
    await run(page);
  } finally {
    await afterAction();
  }
};

// Pick a value in the single-select Default Persona Autocomplete and save,
// waiting on the user PATCH. (assignChip targets `-multiselect` rows; the
// default-persona row is a single-select `-select` Autocomplete instead.)
const assignDefaultPersona = async (page: Page, name: string) => {
  await page.getByTestId('default-persona-edit').click();

  // The preselection is the user's own defaultPersona, and the seeded user has
  // none, so the select always opens empty with its input editable.
  const select = page.getByTestId('default-persona-select');
  const input = select.locator('input');
  await expect(select).toBeVisible();
  await expect(select.getByTestId('autocomplete-selected-item')).toHaveCount(0);
  await expect(input).toBeEditable();
  await input.fill(name);
  const option = await waitForListboxOption(page, input, name);
  await option.click();

  const saveResponse = waitForResponseWithStatus(
    page,
    (r) =>
      r.url().includes('/api/v1/users/') && r.request().method() === 'PATCH',
    200
  );
  await page.getByTestId('default-persona-save').click();
  await saveResponse;
};

const displayName = (entity: {
  responseData: { displayName?: string; name: string };
}) => entity.responseData.displayName ?? entity.responseData.name;

/**
 * Exercises a multi-select profile row end-to-end through the UI: assign
 * `primary`, "change" by adding `alternate` and dropping `primary`, then remove
 * `alternate` so the row ends empty of the test's values. Each save round-trips
 * a PATCH via the assign/remove helpers.
 */
const runChipLifecycle = async (
  page: Page,
  rowTestId: string,
  primary: string,
  alternate: string,
  searchResponseMatcher?: (query: string) => (r: Response) => boolean
) => {
  const card = page.getByTestId(rowTestId);

  await test.step(`Assign ${primary}`, async () => {
    await assignChip(
      page,
      rowTestId,
      primary,
      searchResponseMatcher?.(primary)
    );
    await expect(card).toContainText(primary);
  });

  // Remove before adding: the rows cap their chips at 3 (`+N` holds the rest),
  // and the roles row already carries Admin and DataConsumer.
  await test.step(`Change to ${alternate}`, async () => {
    await removeChip(page, rowTestId, primary);
    await expect(card.getByText(primary)).toHaveCount(0);
    await assignChip(
      page,
      rowTestId,
      alternate,
      searchResponseMatcher?.(alternate)
    );
    await expect(card).toContainText(alternate);
  });

  await test.step(`Remove ${alternate}`, async () => {
    await removeChip(page, rowTestId, alternate);
    await expect(card.getByText(alternate)).toHaveCount(0);
  });
};

const EDIT_ROLE_POLICY_RULES: PolicyRulesType[] = [
  {
    name: 'pw-personal-space-view-rule',
    description: 'Allow ViewAll for the seeded role.',
    resources: ['All'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
];

test.describe('Profile — Profile', PROFILE_TAGS, () => {
  test.beforeAll('Seed entities and a dedicated profile admin', async () => {
    test.setTimeout(120_000);
    const { apiContext, afterAction } = await createAdminApiContext();
    await settleAll([
      personaA.create(apiContext),
      personaB.create(apiContext),
      domainA.create(apiContext),
      domainB.create(apiContext),
      cancelDomain.create(apiContext),
      teamA.create(apiContext),
      teamB.create(apiContext),
      roleAPolicy
        .create(apiContext, EDIT_ROLE_POLICY_RULES)
        .then(() => roleA.create(apiContext, [roleAPolicy.responseData.name])),
      roleBPolicy
        .create(apiContext, EDIT_ROLE_POLICY_RULES)
        .then(() => roleB.create(apiContext, [roleBPolicy.responseData.name])),
      // Admin role → bypasses the view gate and can edit every profile row.
      profileAdmin
        .create(apiContext)
        .then(() => profileAdmin.setAdminRole(apiContext)),
      persistAdmin
        .create(apiContext)
        .then(() => persistAdmin.setAdminRole(apiContext)),
    ]);
    // The Domains picker searches the domain index, which lags the create.
    await settleAll(
      [domainA, domainB].map((domain) =>
        waitForSearchIndexed(
          apiContext,
          domain.responseData.fullyQualifiedName,
          'domain_search_index'
        )
      )
    );
    // Default Persona can only point at a persona the user already holds, so
    // pre-assign personaB via API. personaA stays free for the Persona-row
    // assign/remove persistence test.
    await persistAdmin.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/personas',
          value: [{ id: personaB.responseData.id, type: 'persona' }],
        },
      ],
    });
    // Only cancelDomain is pre-assigned (for the cancel test); every lifecycle
    // row starts empty and is populated through the UI.
    await profileAdmin.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains',
          value: [{ id: cancelDomain.responseData.id, type: 'domain' }],
        },
      ],
    });
    await afterAction();
  });

  test.afterAll('Cleanup seeded entities', async () => {
    const { apiContext, afterAction } = await createAdminApiContext();
    try {
      await settleAll([
        ...[profileAdmin, persistAdmin].map((user) =>
          deleteFixture(apiContext, 'users', user.responseData?.id)
        ),
        ...[personaA, personaB].map((persona) =>
          deleteFixture(apiContext, 'personas', persona.responseData?.id)
        ),
        ...[domainA, domainB, cancelDomain].map((domain) =>
          deleteFixture(apiContext, 'domains', domain.responseData?.id)
        ),
        ...[teamA, teamB].map((team) =>
          deleteFixture(apiContext, 'teams', team.responseData?.id)
        ),
        // A role goes before the policy it references.
        ...[
          [roleA, roleAPolicy],
          [roleB, roleBPolicy],
        ].map(([role, policy]) =>
          deleteFixture(apiContext, 'roles', role.responseData?.id).then(() =>
            deleteFixture(apiContext, 'policies', policy.responseData?.id)
          )
        ),
      ]);
    } finally {
      await afterAction();
    }
  });

  test('persona: assign, change, then remove through the editor', async ({
    browser,
  }) => {
    test.slow();
    await onUserProfile(browser, profileAdmin, async (page) => {
      await runChipLifecycle(
        page,
        'persona',
        displayName(personaA),
        displayName(personaB),
        personasSearchResponse
      );
      await expect(page.getByTestId('persona')).toContainText(
        'No persona assigned'
      );
    });
  });

  test('domains: assign, change, then remove through the editor', async ({
    browser,
  }) => {
    test.slow();
    await onUserProfile(browser, profileAdmin, (page) =>
      runChipLifecycle(
        page,
        'domains',
        displayName(domainA),
        displayName(domainB)
      )
    );
  });

  test('teams: assign, change, then remove through the editor', async ({
    browser,
  }) => {
    test.slow();
    // Teams live in the Permissions tab's Membership section.
    await onUserProfile(
      browser,
      profileAdmin,
      (page) =>
        runChipLifecycle(page, 'teams', displayName(teamA), displayName(teamB)),
      'permissions'
    );
  });

  test('roles: assign, change, remove — admin status is preserved', async ({
    browser,
  }) => {
    test.slow();
    await onUserProfile(
      browser,
      profileAdmin,
      async (page) => {
        const rolesCard = page.getByTestId('roles');
        // Admin is a synthetic chip driven by isAdmin, not a role entity, so it
        // must survive the whole role assign/change/remove cycle.
        await expect(rolesCard).toContainText('Admin');
        await runChipLifecycle(
          page,
          'roles',
          displayName(roleA),
          displayName(roleB),
          rolesSearchResponse
        );
        await expect(rolesCard).toContainText('Admin');
      },
      'permissions'
    );
  });

  test('cancelling an edit discards the change', async ({ browser }) => {
    test.slow();
    await onUserProfile(browser, profileAdmin, async (page) => {
      const domainName =
        cancelDomain.responseData.displayName ?? cancelDomain.responseData.name;
      const domainsCard = page.getByTestId('domains');
      await expect(domainsCard).toContainText(domainName);

      await page.getByTestId('domains-edit').click();
      await getChipRemoveButton(page, 'domains', domainName).click();
      await page.getByTestId('domains-cancel').click();

      await expect(domainsCard).toContainText(domainName);
    });
  });

  test('every permission-source link is routable (no dead "#" links)', async ({
    page,
  }) => {
    await visitProfile(page, 'permissions');

    const panel = page.getByTestId('profile-permissions');
    await expect(panel).toContainText('Permission Summary');

    // The admin belongs to the Organization team, so the Team Permissions
    // section always renders at least one entity link.
    const links = panel.getByRole('link');
    await expect(
      panel.getByRole('link', { name: 'Organization', exact: true })
    ).toBeVisible();

    await test.step('No source link points at the "#" fallback', async () => {
      for (const link of await links.all()) {
        await expect(link).not.toHaveAttribute('href', '#');
      }
    });
  });

  // Team links are settings links: in AI mode they open the team inside the
  // settings modal (ADR:2026-10-21-settings-pages-are-classic-only).
  test('clicking a team permission link opens the team in the settings modal', async ({
    page,
  }) => {
    await visitProfile(page, 'permissions');

    const panel = page.getByTestId('profile-permissions');
    await expect(panel).toContainText('Permission Summary');

    const teamLink = panel.getByRole('link', {
      name: 'Organization',
      exact: true,
    });
    await expect(teamLink).toBeVisible();
    await expect(teamLink).not.toHaveAttribute('href', '#');

    await teamLink.click();

    await test.step('The modal stays open on the team', async () => {
      await expect(page).toHaveURL(/#members\/teams\//);
      await expect(page.getByTestId('ai-profile-page')).toBeVisible();
      await expect(page.getByTestId('team-detail')).toBeVisible();
      await expect(page.getByTestId('profile-permissions')).toHaveCount(0);
    });
  });

  test('shows each nav section’s own content when navigating', async ({
    page,
  }) => {
    await visitProfile(page);

    await test.step('Profile shows the PROFILE and IDENTITY & ACCESS sections', async () => {
      await expect(page.getByTestId('profile-section-profile')).toBeVisible();
      const identity = page.getByTestId('profile-section-identity');
      await expect(identity).toBeVisible();
      await expect(identity).toContainText('Persona');
    });

    await test.step('Access Token renders its own panel', async () => {
      await page.getByTestId('profile-nav-access-token').click();
      await expect(page.getByTestId('access-token-row')).toBeVisible();
    });

    await test.step('Permissions shows the permission summary', async () => {
      await page.getByTestId('profile-nav-permissions').click();
      await expect(page.getByTestId('profile-permissions')).toContainText(
        'Permission Summary'
      );
    });
  });

  // Persistence suite: every editable field is changed through the UI, verified
  // in-session, then the modal is CLOSED and REOPENED (a fresh navigation +
  // getUserByName fetch) to prove the value round-tripped to the server — not
  // just the still-open editor's local state. Removal is verified the same way.
  test('preferred name persists after closing and reopening the modal', async ({
    browser,
  }) => {
    test.slow();
    await onUserProfile(browser, persistAdmin, async (page) => {
      const newName = `PW Persist ${Date.now()}`;
      const profileSection = page.getByTestId('profile-section-profile');

      await test.step('Edit and save the preferred name', async () => {
        await page.getByTestId('preferred-name-edit').click();
        await page
          .getByTestId('preferred-name-input')
          .getByRole('textbox')
          .fill(newName);
        const saveResponse = waitForResponseWithStatus(
          page,
          (r) =>
            r.url().includes('/api/v1/users/') &&
            r.request().method() === 'PATCH',
          200
        );
        await page.getByTestId('preferred-name-save').click();
        await saveResponse;
        await expect(profileSection).toContainText(newName);
      });

      await test.step('The name is still shown after reopening the modal', async () => {
        await closeProfileModal(page);
        await visitProfile(page);
        await expect(page.getByTestId('profile-section-profile')).toContainText(
          newName
        );
      });
    });
  });

  test('default persona persists after closing and reopening the modal', async ({
    browser,
  }) => {
    test.slow();
    await onUserProfile(browser, persistAdmin, async (page) => {
      // personaB is pre-assigned to the user, so it is a valid default choice.
      const persona = displayName(personaB);
      const card = page.getByTestId('default-persona');

      await test.step('Select and save a default persona', async () => {
        await assignDefaultPersona(page, persona);
        await expect(card).toContainText(persona);
      });

      await test.step('The default persona survives a reopen', async () => {
        await closeProfileModal(page);
        await visitProfile(page);
        await expect(page.getByTestId('default-persona')).toContainText(
          persona
        );
      });
    });
  });

  test('persona assignment persists, and its removal persists too', async ({
    browser,
  }) => {
    test.slow();
    await onUserProfile(browser, persistAdmin, async (page) => {
      const persona = displayName(personaA);
      const card = page.getByTestId('persona');

      await test.step('Assign a persona and confirm it survives a reopen', async () => {
        await assignChip(page, 'persona', persona);
        await expect(card).toContainText(persona);
        await closeProfileModal(page);
        await visitProfile(page);
        await expect(page.getByTestId('persona')).toContainText(persona);
      });

      await test.step('Remove the persona and confirm the removal survives a reopen', async () => {
        await removeChip(page, 'persona', persona);
        await closeProfileModal(page);
        await visitProfile(page);
        await expect(
          page.getByTestId('persona').getByText(persona)
        ).toHaveCount(0);
      });
    });
  });

  test('domains assignment persists, and its removal persists too', async ({
    browser,
  }) => {
    test.slow();
    await onUserProfile(browser, persistAdmin, async (page) => {
      const domain = displayName(domainA);
      const card = page.getByTestId('domains');

      await test.step('Assign a domain and confirm it survives a reopen', async () => {
        await assignChip(page, 'domains', domain);
        await expect(card).toContainText(domain);
        await closeProfileModal(page);
        await visitProfile(page);
        await expect(page.getByTestId('domains')).toContainText(domain);
      });

      await test.step('Remove the domain and confirm the removal survives a reopen', async () => {
        await removeChip(page, 'domains', domain);
        await closeProfileModal(page);
        await visitProfile(page);
        await expect(page.getByTestId('domains').getByText(domain)).toHaveCount(
          0
        );
      });
    });
  });

  test('team membership persists, and its removal persists too', async ({
    browser,
  }) => {
    test.slow();
    await onUserProfile(
      browser,
      persistAdmin,
      async (page) => {
        const team = displayName(teamA);
        const card = page.getByTestId('teams');

        await test.step('Assign a team and confirm it survives a reopen', async () => {
          await assignChip(page, 'teams', team);
          await expect(card).toContainText(team);
          await closeProfileModal(page);
          await visitProfile(page, 'permissions');
          await expect(page.getByTestId('teams')).toContainText(team);
        });

        await test.step('Remove the team and confirm the removal survives a reopen', async () => {
          await removeChip(page, 'teams', team);
          await closeProfileModal(page);
          await visitProfile(page, 'permissions');
          await expect(page.getByTestId('teams').getByText(team)).toHaveCount(
            0
          );
        });
      },
      'permissions'
    );
  });

  test('role assignment persists (Admin preserved), and its removal persists too', async ({
    browser,
  }) => {
    test.slow();
    await onUserProfile(
      browser,
      persistAdmin,
      async (page) => {
        const role = displayName(roleA);
        const card = page.getByTestId('roles');
        await expect(card).toContainText('Admin');

        await test.step('Assign a role and confirm it survives a reopen', async () => {
          await assignChip(page, 'roles', role, rolesSearchResponse(role));
          await expect(card).toContainText(role);
          await closeProfileModal(page);
          await visitProfile(page, 'permissions');
          const reopened = page.getByTestId('roles');
          await expect(reopened).toContainText(role);
          await expect(reopened).toContainText('Admin');
        });

        await test.step('Remove the role and confirm the removal survives a reopen', async () => {
          await removeChip(page, 'roles', role);
          await closeProfileModal(page);
          await visitProfile(page, 'permissions');
          await expect(page.getByTestId('roles').getByText(role)).toHaveCount(
            0
          );
          await expect(page.getByTestId('roles')).toContainText('Admin');
        });
      },
      'permissions'
    );
  });
});

const denyUser = new UserClass();
const denyPolicy = new PolicyClass();
const denyRole = new RolesClass();

// A deny rule on the USER resource overrides the broad Organization allow, so
// this user has no view permission on user entities — the case the classic
// profile 403s and the personal-space layout must block.
const DENY_USER_VIEW_RULES: PolicyRulesType[] = [
  {
    name: 'deny-personal-space-user-view',
    description: 'Deny viewing user entities.',
    resources: ['user'],
    operations: ['ViewAll', 'ViewBasic'],
    effect: 'deny',
  },
];

test.describe('Profile — Personal space permissions', PROFILE_TAGS, () => {
  test.beforeAll('Create a user denied USER view', async () => {
    const { apiContext, afterAction } = await createAdminApiContext();
    await denyUser.create(apiContext);
    await denyPolicy.create(apiContext, DENY_USER_VIEW_RULES);
    await denyRole.create(apiContext, [denyPolicy.responseData.name]);
    await denyUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/roles/-',
          value: { id: denyRole.responseData.id, type: 'role' },
        },
      ],
    });
    await afterAction();
  });

  test.afterAll('Cleanup the denied user, role and policy', async () => {
    const { apiContext, afterAction } = await createAdminApiContext();
    try {
      await settleAll([
        deleteFixture(apiContext, 'users', denyUser.responseData?.id),
        deleteFixture(apiContext, 'roles', denyRole.responseData?.id).then(() =>
          deleteFixture(apiContext, 'policies', denyPolicy.responseData?.id)
        ),
      ]);
    } finally {
      await afterAction();
    }
  });

  test('a non-admin viewer can browse but cannot edit admin fields', async ({
    viewOnlyPage,
  }) => {
    test.slow();

    await test.step('Profile renders for the permitted viewer', async () => {
      await visitProfile(viewOnlyPage);
    });

    await test.step('Persona assignment is locked (admin-managed)', async () => {
      // Persona assignment is admin-only: no edit affordance, a lock +
      // "Admin-managed" is shown instead (same as teams/roles). The lock and
      // the self-editable Default Persona row prove the rows have resolved
      // their permissions before the absence checks below.
      await expect(viewOnlyPage.getByTestId('persona-locked')).toBeVisible();
      await expect(
        viewOnlyPage.getByTestId('default-persona-edit')
      ).toBeVisible();
      await expect(viewOnlyPage.getByTestId('persona-edit')).toHaveCount(0);
    });

    await test.step('The Domains row exposes no edit control', async () => {
      await expect(viewOnlyPage.getByTestId('domains')).toBeVisible();
      await expect(viewOnlyPage.getByTestId('domains-edit')).toHaveCount(0);
    });

    await test.step('Self can still set their own default persona', async () => {
      // Default Persona is its own row, editable by the user themselves.
      await viewOnlyPage.getByTestId('default-persona-edit').click();
      const select = viewOnlyPage.getByTestId('default-persona-select');
      await expect(select).toBeVisible();
      await expect(select).not.toHaveAttribute('data-disabled');
      await expect(select.locator('input')).toBeEditable();
    });

    await test.step('Teams & Roles are Admin-managed in the Permissions tab', async () => {
      await visitProfile(viewOnlyPage, 'permissions');
      // No edit affordance; a lock + "Admin-managed" is shown instead.
      await expect(viewOnlyPage.getByTestId('teams-locked')).toBeVisible();
      await expect(viewOnlyPage.getByTestId('roles-locked')).toBeVisible();
      await expect(viewOnlyPage.getByTestId('teams-edit')).toHaveCount(0);
      await expect(viewOnlyPage.getByTestId('roles-edit')).toHaveCount(0);
    });

    await test.step('Inbox and My Data also render for the permitted viewer', async () => {
      await visitInbox(viewOnlyPage);
      await visitMyData(viewOnlyPage);
    });
  });

  test('a user without USER view permission is blocked across the personal space', async ({
    browser,
  }) => {
    test.slow();
    // A clean (non-admin) context — the file's admin storageState would
    // otherwise leak into browser.newPage().
    const { page, afterAction } = await performUserLogin(browser, denyUser);

    // Scope the placeholder lookup: the "/" home route resolves to the gated
    // /my-data page, so with the Profile modal open BOTH the page background and
    // the modal dialog render a permission-error-placeholder. Default to the
    // page for the routed steps (single placeholder); the modal step passes the
    // dialog to disambiguate.
    //
    // The gate is a lazy chunk that renders a loader until its USER permission
    // fetch settles; on a contended runner that fetch can start seconds late,
    // so the placeholder gets the AI-shell ceiling rather than the 5s default.
    const expectGateError = async (scope: Page | Locator = page) => {
      await expect(
        scope.getByTestId('permission-error-placeholder')
      ).toBeVisible({ timeout: AI_SHELL_TIMEOUT });
      await expect(page.getByTestId('personal-space')).toHaveCount(0);
    };

    try {
      // Inbox and My Data are routed pages gated by the same PersonalSpaceGate.
      for (const route of [
        PERSONAL_SPACE_ROUTES.INBOX,
        PERSONAL_SPACE_ROUTES.MY_DATA,
      ]) {
        await test.step(`${route} shows the permission error`, async () => {
          await gotoPersonalSpace(page, route);
          await expectGateError();
        });
      }

      // Profile is modal-only; the gate replaces its content with the error.
      await test.step('Profile modal shows the permission error', async () => {
        await openProfileModal(page);
        await expectGateError(page.getByRole('dialog'));
        await expect(page.getByTestId('ai-profile-page')).toHaveCount(0);
      });
    } finally {
      await afterAction();
    }
  });
});

const NEW_PASSWORD = 'NewUser@OMD456';

test.describe('Profile — Profile security', PROFILE_TAGS, () => {
  test('the Security section offers a change-password action, collapsed by default', async ({
    freshUserPage: { page },
  }) => {
    test.slow();
    await visitProfile(page);
    const section = page.getByTestId('profile-section-security');
    await expect(section).toBeVisible();
    await expect(section).toContainText('Password');
    await expect(page.getByTestId('change-password-button')).toBeVisible();

    await test.step('The form is revealed only on demand', async () => {
      await expect(page.getByTestId('current-password-input')).toHaveCount(0);
      await openChangePasswordForm(page);
      await expect(page.getByTestId('new-password-input')).toBeVisible();
      await expect(page.getByTestId('confirm-password-input')).toBeVisible();
      await expect(page.getByTestId('change-password-button')).toHaveCount(0);
    });
  });

  test('submission is blocked until the new password meets every requirement', async ({
    freshUserPage: { page, user },
  }) => {
    test.slow();
    await visitProfile(page);
    await openChangePasswordForm(page);
    const submit = page.getByTestId('update-password-button');
    const strength = page.getByTestId('password-strength-label');

    await test.step('An empty form cannot be submitted', async () => {
      await expect(submit).toBeDisabled();
      await expect(page.getByTestId('password-strength-meter')).toHaveCount(0);
    });

    await test.step('A password missing every rule but length reads Weak', async () => {
      await fillChangePasswordForm(page, {
        current: user.data.password,
        next: 'weakpassword',
      });
      await expect(strength).toHaveText('Weak');
      await expect(submit).toBeDisabled();
    });

    await test.step('Adding case and a digit reaches Medium, still not submittable', async () => {
      // Refill all three fields: leaving `confirm` on the previous value
      // would keep the button disabled on the mismatch instead, so the
      // assertion below would pass even with the strength gate removed.
      await fillChangePasswordForm(page, {
        current: user.data.password,
        next: 'Weakpass1',
      });
      await expect(strength).toHaveText('Medium');
      await expect(submit).toBeDisabled();
    });

    await test.step('A password satisfying all four rules reads Strong', async () => {
      await fillChangePasswordForm(page, {
        current: user.data.password,
        next: NEW_PASSWORD,
      });
      await expect(strength).toHaveText('Strong');
      await expect(submit).toBeEnabled();
    });

    await test.step('A mismatched confirmation warns and blocks submission', async () => {
      await fillPasswordField(
        page,
        'confirm-password-input',
        `${NEW_PASSWORD}7`
      );
      await expect(page.getByText("Password Doesn't Match")).toBeVisible();
      await expect(submit).toBeDisabled();
    });

    await test.step('Cancelling discards what was typed', async () => {
      await page.getByTestId('cancel-change-password-button').click();
      await openChangePasswordForm(page);
      await expect(
        page.getByTestId('new-password-input').locator('input')
      ).toHaveValue('');
    });
  });

  test('a wrong current password is rejected and the form stays open', async ({
    freshUserPage: { page },
  }) => {
    test.slow();
    await visitProfile(page);
    await openChangePasswordForm(page);
    await fillChangePasswordForm(page, {
      current: 'Wrong@OMD123',
      next: NEW_PASSWORD,
    });

    const response = await submitChangePassword(page);
    // BasicAuthenticator rejects a wrong old password with
    // 400 INCORRECT_OLD_PASSWORD.
    expect(response.status()).toBe(400);

    await expect(page.getByTestId('current-password-input')).toBeVisible();
    await expect(page.getByTestId('change-password-button')).toHaveCount(0);
  });

  test('changing the password succeeds and the new password signs the user in', async ({
    browser,
    freshUserPage: { page, user },
  }) => {
    test.slow();
    await visitProfile(page);
    await openChangePasswordForm(page);
    await fillChangePasswordForm(page, {
      current: user.data.password,
      next: NEW_PASSWORD,
    });

    const response = await submitChangePassword(page);
    expect(response.status()).toBe(200);

    await test.step('The form collapses back to the action', async () => {
      await expect(page.getByTestId('change-password-button')).toBeVisible();
      await expect(page.getByTestId('new-password-input')).toHaveCount(0);
    });

    await test.step('The new password is accepted on a fresh sign-in', async () => {
      // performUserLogin signs in with `data.password`, so point it at the
      // rotated credential — reaching the Profile modal proves the change was
      // persisted server-side, not just reflected in the open form.
      user.data.password = NEW_PASSWORD;
      await onUserProfile(browser, user, async (page) => {
        await expect(page.getByTestId('profile-details-panel')).toBeVisible();
      });
    });
  });
});
