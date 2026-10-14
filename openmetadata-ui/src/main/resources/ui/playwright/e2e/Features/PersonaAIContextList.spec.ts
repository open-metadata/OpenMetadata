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
 * E2E tests for Context Center → AI Context persona table: the user flows (open a persona, toggle
 * its context, page through the list) and the backend state they leave behind. How each column
 * renders is covered by ContextCenterAIContextPage.test.tsx.
 */
import { Page, Request, Response } from '@playwright/test';
import { expect, test } from '../../support/fixtures/userPages';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { getDefaultAdminAPIContext } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  findPersonaAIContextRow,
  openPersonaAIContext,
} from '../../utils/personaAIContext';

const PERSONA_LIST_PATH = '/api/v1/personas';
const STATUS_PATH = '/api/v1/personas/aiContext/status';
const ASSIGNED_USER_COUNT = 2;

const isPersonaListRequest = (request: Request) =>
  new URL(request.url()).pathname === PERSONA_LIST_PATH &&
  request.method() === 'GET';

const isStatusRequest = (request: Request) =>
  new URL(request.url()).pathname === STATUS_PATH && request.method() === 'GET';

test.describe.serial('Persona AI Context — persona table', () => {
  let persona: PersonaClass;
  let assignedUsers: UserClass[];

  test.beforeAll(
    'Create a persona with assigned users',
    async ({ browser }) => {
      // beforeAll can run more than once per worker, so state is rebuilt here, not at describe scope.
      persona = new PersonaClass();
      assignedUsers = Array.from(
        { length: ASSIGNED_USER_COUNT },
        () => new UserClass()
      );
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );
      await Promise.all(
        assignedUsers.map((user) => user.create(apiContext, false))
      );
      await persona.create(
        apiContext,
        assignedUsers.map((user) => user.responseData.id)
      );
      await afterAction();
    }
  );

  test.afterAll('Remove the persona and its users', async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );
    await persona.delete(apiContext);
    await Promise.all(assignedUsers.map((user) => user.delete(apiContext)));
    await afterAction();
  });

  test("clicking a row opens that persona's AI context", async ({
    adminPage: page,
  }) => {
    const response = await openPersonaAIContext(page, persona.data.name);

    expect(response.status()).toBe(200);
    expect(new URL(response.url()).pathname).toBe(
      `/api/v1/personas/${persona.responseData.id}/aiContext`
    );
  });

  test('toggling Enabled saves it to the backend without opening the persona', async ({
    adminPage: page,
    browser,
  }) => {
    const row = await findPersonaAIContextRow(page, persona.data.name);

    const saved = page.waitForResponse(
      (response: Response) =>
        new URL(response.url()).pathname ===
          `/api/v1/personas/${persona.responseData.id}/aiContext` &&
        response.request().method() === 'PUT'
    );
    await row
      .getByTestId(`ai-context-persona-enabled-${persona.data.name}`)
      .click();
    const response = await saved;

    expect(response.ok()).toBe(true);
    await expect(
      page.getByTestId('context-center-ai-context-page')
    ).toBeVisible();

    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );
    const stored = await apiContext.get(
      `/api/v1/personas/${persona.responseData.id}/aiContext`
    );
    expect((await stored.json()).enabled).toBe(false);
    await afterAction();
  });

  test('a non-admin cannot toggle context and never requests cache status', async ({
    dataConsumerPage: page,
  }) => {
    const statusRequests: string[] = [];
    page.on('request', (request) => {
      if (isStatusRequest(request)) {
        statusRequests.push(request.url());
      }
    });

    const row = await findPersonaAIContextRow(page, persona.data.name);

    await expect(row.getByRole('switch')).toBeDisabled();
    expect(statusRequests).toHaveLength(0);
  });
});

test.describe('Persona AI Context — persona table pagination', () => {
  const NEXT_PAGE_CURSOR = 'next-page-cursor';
  const PREVIOUS_PAGE_CURSOR = 'previous-page-cursor';
  const TOTAL_PERSONAS = 30;

  const buildMockPersona = (name: string, id: string) => ({
    contextDefinition: { enabled: true, rules: [] },
    displayName: name,
    fullyQualifiedName: name,
    id,
    name,
    users: [],
  });

  const FIRST_PAGE_PERSONA = buildMockPersona(
    'pw-first-page-persona',
    '11111111-1111-4111-8111-111111111111'
  );
  const SECOND_PAGE_PERSONA = buildMockPersona(
    'pw-second-page-persona',
    '22222222-2222-4222-8222-222222222222'
  );

  const mockPersonaPages = async (page: Page) => {
    await page.route(
      (url) => url.pathname === PERSONA_LIST_PATH,
      async (route) => {
        const requestsSecondPage =
          new URL(route.request().url()).searchParams.get('after') ===
          NEXT_PAGE_CURSOR;
        await route.fulfill({
          json: requestsSecondPage
            ? {
                data: [SECOND_PAGE_PERSONA],
                paging: { before: PREVIOUS_PAGE_CURSOR, total: TOTAL_PERSONAS },
              }
            : {
                data: [FIRST_PAGE_PERSONA],
                paging: { after: NEXT_PAGE_CURSOR, total: TOTAL_PERSONAS },
              },
        });
      }
    );
    await page.route(
      (url) => url.pathname === STATUS_PATH,
      (route) =>
        route.fulfill({ json: { data: [], paging: { total: TOTAL_PERSONAS } } })
    );
  };

  test('next page fetches personas and their status with the same cursor', async ({
    adminPage: page,
  }) => {
    await mockPersonaPages(page);
    const firstPageRequest = page.waitForRequest(isPersonaListRequest);
    await page.goto('/context-center/ai-context', {
      waitUntil: 'domcontentloaded',
    });
    await firstPageRequest;
    await waitForAllLoadersToDisappear(page);

    await expect(
      page.getByTestId(`ai-context-persona-${FIRST_PAGE_PERSONA.name}`)
    ).toBeVisible();

    const isNextPage = (request: Request) =>
      new URL(request.url()).searchParams.get('after') === NEXT_PAGE_CURSOR;
    const nextPersonasRequest = page.waitForRequest(
      (request) => isPersonaListRequest(request) && isNextPage(request)
    );
    const nextStatusRequest = page.waitForRequest(
      (request) => isStatusRequest(request) && isNextPage(request)
    );
    await page.getByTestId('next').click();
    await Promise.all([nextPersonasRequest, nextStatusRequest]);

    await expect(
      page.getByTestId(`ai-context-persona-${SECOND_PAGE_PERSONA.name}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`ai-context-persona-${FIRST_PAGE_PERSONA.name}`)
    ).not.toBeVisible();

    // The cursor is saved with the page number, so a reload (or browser Back) refetches page two.
    const reloadedPersonasRequest = page.waitForRequest(
      (request) => isPersonaListRequest(request) && isNextPage(request)
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await reloadedPersonasRequest;

    await expect(
      page.getByTestId(`ai-context-persona-${SECOND_PAGE_PERSONA.name}`)
    ).toBeVisible();
  });
});
