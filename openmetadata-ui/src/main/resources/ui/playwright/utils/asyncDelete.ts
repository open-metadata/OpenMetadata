/*
 *  Copyright 2024 Collate.
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

import { expect, Page, WebSocketRoute } from '@playwright/test';

/**
 * Entity types for async delete API routes
 */
export type AsyncDeleteEntityType = 'glossaries' | 'glossaryTerms';

/**
 * WebSocket delete event status
 */
export type DeleteEventStatus = 'COMPLETED' | 'FAILED';

/**
 * WebSocket delete event payload
 */
export interface DeleteWebSocketEvent {
  jobId: string;
  status: DeleteEventStatus;
  entityName: string;
  error?: string | null;
}

// Store for WebSocket routes to send messages later
let wsRoute: WebSocketRoute | null = null;

/**
 * Sets up WebSocket route interception for testing.
 * Call this before navigating to the page.
 * Uses Playwright's native routeWebSocket API.
 * @see https://playwright.dev/docs/api/class-websocketroute
 */
export const setupWebSocketRoute = async (page: Page) => {
  await page.routeWebSocket(/.*activity-feed.*/, (ws) => {
    wsRoute = ws;
    // Connect to actual server and forward messages
    const server = ws.connectToServer();
    // Forward messages from page to server
    ws.onMessage((message) => server.send(message));
    // Forward messages from server to page
    server.onMessage((message) => ws.send(message));
  });
};

/**
 * Sends a Socket.io formatted message to the page via WebSocket.
 * Socket.io message format: "42[\"event\",data]"
 */
const sendSocketIOMessage = (event: string, data: unknown) => {
  if (!wsRoute) {
    throw new Error('WebSocket route not set up. Call setupWebSocketRoute first.');
  }
  // Socket.io protocol: 42 = EVENT packet
  const message = `42["${event}",${JSON.stringify(JSON.stringify(data))}]`;
  wsRoute.send(message);
};

/**
 * Emits a delete entity WebSocket event.
 */
export const emitDeleteWebSocketEvent = (event: DeleteWebSocketEvent) => {
  sendSocketIOMessage('deleteEntityChannel', event);
};

/**
 * Emits a COMPLETED delete WebSocket event.
 */
export const emitDeleteSuccess = (jobId: string, entityName: string) => {
  emitDeleteWebSocketEvent({
    jobId,
    status: 'COMPLETED',
    entityName,
    error: null,
  });
};

/**
 * Emits a FAILED delete WebSocket event.
 */
export const emitDeleteFailure = (
  jobId: string,
  entityName: string,
  error = 'Delete operation failed'
) => {
  emitDeleteWebSocketEvent({
    jobId,
    status: 'FAILED',
    entityName,
    error,
  });
};

/**
 * Clears the WebSocket route reference.
 */
export const clearWebSocketRoute = () => {
  wsRoute = null;
};

/**
 * Mock response options for async delete API
 */
export interface MockDeleteApiOptions {
  status: number;
  message: string;
  jobId?: string;
  hardDelete?: boolean;
  recursive?: boolean;
}

/**
 * Mocks the async delete API to return an error response.
 * Use this to test delete failure scenarios.
 *
 * @param page - Playwright page
 * @param entityType - The entity type ('glossaries' or 'glossaryTerms')
 * @param status - HTTP status code (e.g., 400, 500)
 * @param message - Error message to return
 */
export const mockDeleteApiError = async (
  page: Page,
  entityType: AsyncDeleteEntityType,
  status: number,
  message: string
) => {
  await page.route(`**/api/v1/${entityType}/async/**`, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({
        code: status,
        message,
      }),
    });
  });
};

/**
 * Mocks the async delete API to return a success response with jobId.
 * The backend won't actually delete since we're mocking.
 * Use this to test optimistic deletion and recovery flows.
 *
 * @param page - Playwright page
 * @param entityType - The entity type ('glossaries' or 'glossaryTerms')
 * @param jobId - Optional job ID (defaults to timestamp-based ID)
 * @returns The jobId used in the mock
 */
export const mockDeleteApiSuccess = async (
  page: Page,
  entityType: AsyncDeleteEntityType,
  jobId?: string
): Promise<string> => {
  const mockJobId = jobId ?? `test-job-${Date.now()}`;

  await page.route(`**/api/v1/${entityType}/async/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        jobId: mockJobId,
        message: 'Delete operation initiated',
        hardDelete: true,
        recursive: true,
      }),
    });
  });

  return mockJobId;
};

/**
 * Removes the async delete API mock.
 *
 * @param page - Playwright page
 * @param entityType - The entity type ('glossaries' or 'glossaryTerms')
 */
export const unmockDeleteApi = async (
  page: Page,
  entityType: AsyncDeleteEntityType
) => {
  await page.unroute(`**/api/v1/${entityType}/async/**`);
};

/**
 * Opens the delete confirmation modal via the manage button.
 * Does NOT click confirm - use confirmDelete() for that.
 *
 * @param page - Playwright page
 */
export const openDeleteModal = async (page: Page) => {
  await page.click('[data-testid="manage-button"]');
  await page.click('[data-testid="delete-button"]');
  await expect(page.locator('[role="dialog"]')).toBeVisible();
};

/**
 * Fills the DELETE confirmation and clicks confirm button.
 * Should be called after openDeleteModal().
 *
 * @param page - Playwright page
 */
export const confirmDelete = async (page: Page) => {
  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');
  await page.click('[data-testid="confirm-button"]');
};

/**
 * Opens delete modal and confirms deletion in one step.
 * Combines openDeleteModal() and confirmDelete().
 *
 * @param page - Playwright page
 */
export const initiateDelete = async (page: Page) => {
  await openDeleteModal(page);
  await confirmDelete(page);
};

/**
 * Waits for a response from the glossaries list API.
 * Useful for verifying refetch after delete failure recovery.
 *
 * @param page - Playwright page
 * @returns Promise that resolves when the API responds
 */
export const waitForGlossaryListRefetch = (page: Page) => {
  return page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/glossaries') &&
      response.status() === 200
  );
};

/**
 * Waits for a response from the glossary terms API.
 * Useful for verifying refetch after delete failure recovery.
 *
 * @param page - Playwright page
 * @returns Promise that resolves when the API responds
 */
export const waitForGlossaryTermsRefetch = (page: Page) => {
  return page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/glossaryTerms') &&
      response.status() === 200
  );
};

/**
 * Verifies that a glossary is visible in the sidebar menu.
 *
 * @param page - Playwright page
 * @param displayName - The display name of the glossary
 */
export const expectGlossaryVisible = async (
  page: Page,
  displayName: string
) => {
  await expect(
    page.getByRole('menuitem', { name: displayName })
  ).toBeVisible();
};

/**
 * Verifies that a glossary is NOT visible in the sidebar menu.
 *
 * @param page - Playwright page
 * @param displayName - The display name of the glossary
 */
export const expectGlossaryNotVisible = async (
  page: Page,
  displayName: string
) => {
  await expect(
    page.getByRole('menuitem', { name: displayName })
  ).not.toBeVisible();
};

/**
 * Verifies that a glossary term is visible in the table.
 *
 * @param page - Playwright page
 * @param displayName - The display name of the glossary term
 */
export const expectGlossaryTermVisible = async (
  page: Page,
  displayName: string
) => {
  await expect(
    page.getByRole('cell', { name: displayName })
  ).toBeVisible();
};

/**
 * Verifies that a glossary term is NOT visible in the table.
 *
 * @param page - Playwright page
 * @param displayName - The display name of the glossary term
 */
export const expectGlossaryTermNotVisible = async (
  page: Page,
  displayName: string
) => {
  await expect(
    page.getByRole('cell', { name: displayName })
  ).not.toBeVisible();
};
