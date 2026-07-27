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
import { expect, Page, test } from '@playwright/test';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { StorageServiceClass } from '../../support/entity/service/StorageServiceClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const service = new StorageServiceClass();
const manifestTag = `pw-manifest-${uuid()}`;
const initialBucket = `${manifestTag}-initial`;
const updatedBucket = `${manifestTag}-updated`;
const initialManifest = `{"entries":[{"containerName":"${initialBucket}","dataPath":"data/*.parquet","structureFormat":"parquet"}]}`;
const updatedManifest = `{"entries":[{"containerName":"${updatedBucket}","dataPath":"logs/*.json","structureFormat":"json"}]}`;

let pipelineName = '';

const openMetadataAgentEditForm = async (page: Page) => {
  await redirectToHomePage(page);
  await service.visitEntityPage(page);
  await page.getByTestId('data-assets-header').waitFor();
  await page.getByTestId('agents').click();

  const metadataSubTab = page.getByTestId('metadata-sub-tab');
  if (await metadataSubTab.isVisible()) {
    await metadataSubTab.click();
  }

  await page.getByTestId('more-actions').first().click();
  await page.getByTestId('edit-button').click();

  // The add/edit ingestion form renders here. On the buggy build this throws
  // "Unsupported widget definition: object" from RJSF getWidget because the
  // manifest widget was registered as a raw React.lazy object.
  await page.getByTestId('add-ingestion-container').waitFor();
};

test.describe(
  'Storage metadata agent manifest widget',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await service.create(apiContext);

      pipelineName = `pw-storage-metadata-${uuid()}`;
      const pipelineResponse = await apiContext.post(
        '/api/v1/services/ingestionPipelines',
        {
          data: {
            airflowConfig: { scheduleInterval: '0 0 * * *' },
            loggerLevel: 'INFO',
            name: pipelineName,
            pipelineType: 'metadata',
            service: {
              id: service.entityResponseData.id,
              type: 'storageService',
            },
            sourceConfig: {
              config: {
                type: 'StorageMetadata',
                defaultManifest: initialManifest,
              },
            },
          },
        }
      );

      expect(pipelineResponse.status()).toBe(201);

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await service.delete(apiContext);
      await afterAction();
    });

    test('edit form renders and manifest edits are saved', async ({ page }) => {
      test.slow();

      await openMetadataAgentEditForm(page);

      const manifestWidget = page.locator('.manifest-json-widget');

      await test.step('Manifest widget renders without crashing', async () => {
        await expect(manifestWidget).toBeVisible();
      });

      await test.step('Saved manifest is loaded into the widget', async () => {
        await expect(manifestWidget).toContainText(initialBucket);
      });

      await test.step('Manifest value can be edited in the widget', async () => {
        const editor = manifestWidget.locator('.CodeMirror');
        await editor.click();
        await page.keyboard.press('ControlOrMeta+A');
        await page.keyboard.press('Delete');
        // insertText bypasses keydown so CodeMirror autoCloseBrackets does not
        // duplicate the JSON braces/quotes we type.
        await page.keyboard.insertText(updatedManifest);

        await expect(manifestWidget).toContainText(updatedBucket);
      });

      await test.step('Edited manifest is persisted on save', async () => {
        await page.getByTestId('next-button').click();

        const updateResponse = page.waitForResponse(
          (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes('/services/ingestionPipelines/') &&
            response.status() === 200
        );

        await page.getByTestId('next-button').click();

        const updatedPipeline = await (await updateResponse).json();

        expect(updatedPipeline.sourceConfig.config.defaultManifest).toContain(
          updatedBucket
        );
      });

      await test.step('Reopening the agent shows the persisted manifest', async () => {
        await openMetadataAgentEditForm(page);

        await expect(page.locator('.manifest-json-widget')).toContainText(
          updatedBucket
        );
      });
    });

    test('manifest editor is full width, clears cleanly and keeps caret stable', async ({
      page,
    }) => {
      test.slow();

      await openMetadataAgentEditForm(page);

      const manifestWidget = page.locator('.manifest-json-widget');
      await expect(manifestWidget).toBeVisible();

      await test.step('Editor spans the full form width', async () => {
        const widgetBox = await manifestWidget.boundingBox();
        const containerBox = await page
          .getByTestId('add-ingestion-container')
          .boundingBox();

        // A half-width grid cell sits near ~0.5; a full-row field is well above.
        expect(widgetBox && containerBox).toBeTruthy();
        expect(widgetBox!.width / containerBox!.width).toBeGreaterThan(0.7);
      });

      const editor = manifestWidget.locator('.CodeMirror');

      await test.step('Clearing the editor leaves it empty, not the sample', async () => {
        await editor.click();
        await page.keyboard.press('ControlOrMeta+A');
        await page.keyboard.press('Delete');

        // CodeMirror inserts the placeholder element only while the document is
        // empty; its presence proves the value cleared instead of reverting to
        // the sample (the stale-default bug).
        const placeholder = manifestWidget.locator('.CodeMirror-placeholder');
        await expect(placeholder).toBeAttached();

        // It must read as a hint: muted global placeholder colour, and
        // white-space preserved so the multi-line sample keeps its line breaks.
        const style = await placeholder.evaluate((el) => {
          const computed = getComputedStyle(el);

          return { color: computed.color, whiteSpace: computed.whiteSpace };
        });
        expect(style.whiteSpace).toBe('pre-wrap');
        expect(style.color).toBe('rgb(113, 118, 128)');

        // The full multi-line sample is present (not truncated to one line).
        const placeholderText = await placeholder.textContent();
        expect(placeholderText).toContain('containerName');
        expect(placeholderText?.split('\n').length).toBeGreaterThan(5);

        // The editor keeps its full height when empty so the sample is visible
        // rather than collapsing to ~1 line.
        const editorBox = await editor.boundingBox();
        expect(editorBox!.height).toBeGreaterThan(150);
      });

      await test.step('Typing valid JSON is not live-reformatted', async () => {
        // insertText bypasses keydown so autoCloseBrackets does not interfere.
        await page.keyboard.insertText('{"x":1,"y":2}');

        // With live auto-format the buffer would re-indent to 4 lines on each
        // keystroke (the cause of the caret jump); disabled, it stays one line.
        await expect(manifestWidget.locator('.CodeMirror-line')).toHaveCount(1);
      });
    });

    test('auto-close keeps the caret between the inserted pair', async ({
      page,
    }) => {
      test.slow();
      await openMetadataAgentEditForm(page);

      const editor = page.locator('.manifest-json-widget .CodeMirror');
      await editor.click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Delete');

      // Typing `{` auto-inserts `}` with the caret between them; the next char
      // must land inside. Before the fix the caret jumped to the end (`{}x`).
      await page.keyboard.type('{');
      await page.keyboard.type('x');

      const value = await editor.evaluate((el) =>
        (
          el as unknown as { CodeMirror: { getValue(): string } }
        ).CodeMirror.getValue()
      );
      expect(value).toBe('{x}');
    });
  }
);
