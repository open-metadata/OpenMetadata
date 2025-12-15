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

import { expect, Page } from '@playwright/test';
import {
  cleanupWebSocketMock,
  getWebSocketMock,
  setupWebSocketMock,
} from './websocket';

// Re-export WebSocket utilities for convenience
export {
  cleanupWebSocketMock as clearMockedWebSocket,
  setupWebSocketMock as setupMockedWebSocket,
};

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

/**
 * Emits a delete entity WebSocket event.
 */
export const emitDeleteWebSocketEvent = (event: DeleteWebSocketEvent) => {
  getWebSocketMock().emit('deleteEntityChannel', event);
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
 * Mocks the async delete API to return a success response with jobId.
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
 */
export const unmockDeleteApi = async (
  page: Page,
  entityType: AsyncDeleteEntityType
) => {
  await page.unroute(`**/api/v1/${entityType}/async/**`);
};

/**
 * Opens the delete confirmation modal via the manage button.
 */
export const openDeleteModal = async (page: Page) => {
  await page.click('[data-testid="manage-button"]');
  await page.click('[data-testid="delete-button"]');
  await expect(page.locator('[role="dialog"]')).toBeVisible();
};

/**
 * Fills the DELETE confirmation and clicks confirm button.
 */
export const confirmDelete = async (page: Page) => {
  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');
  await page.click('[data-testid="confirm-button"]');
};

/**
 * Opens delete modal and confirms deletion in one step.
 */
export const initiateDelete = async (page: Page) => {
  await openDeleteModal(page);
  await confirmDelete(page);
};

/**
 * Waits for a response from the glossaries list API.
 */
export const waitForGlossaryListRefetch = (page: Page) => {
  return page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/glossaries') &&
      response.status() === 200
  );
};

/**
 * Verifies that a glossary is visible in the sidebar menu.
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
 */
export const expectGlossaryNotVisible = async (
  page: Page,
  displayName: string
) => {
  await expect(
    page.getByRole('menuitem', { name: displayName })
  ).not.toBeVisible();
};
