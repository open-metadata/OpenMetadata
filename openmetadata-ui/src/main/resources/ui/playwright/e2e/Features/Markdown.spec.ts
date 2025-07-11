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
import test, { expect } from '@playwright/test';
import { Glossary } from '../../support/glossary/Glossary';
import { createNewPage, redirectToHomePage } from '../../utils/common';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const glossary = new Glossary();
glossary.data.description = `# Heading 1
## Heading 2

Normal text with **bold** and *italic* and ~~strikethrough~~ and _underline_.

* Bullet point 1
* Bullet point 2
  * Nested bullet point

1. Numbered list
2. Second item

> Blockquote text

\`inline code\`

\`\`\`
code block
multiple lines
\`\`\`

| Table | Header |
|-------|--------|
| Cell 1 | Cell 2 |

[Link](https://example.com)

:smile: emoji`;

test.describe('Markdown', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await glossary.visitPage(page);
  });

  test('should render markdown', async ({ page }) => {
    // Verify various markdown elements are rendered correctly
    const container = page.getByTestId('asset-description-container');

    // check if read-more-button exists the perform click
    const readMoreButton = page.getByTestId('read-more-button');
    if (await readMoreButton.isVisible()) {
      await readMoreButton.click();
    }

    await expect(container.locator('h1')).toHaveText('Heading 1');
    await expect(container.locator('h2')).toHaveText('Heading 2');
    await expect(container.locator('strong')).toHaveText('bold');
    await expect(container.locator('em')).toHaveText('italic');
    await expect(container.locator('s')).toHaveText('strikethrough');
    await expect(container.locator('a[href="https://example.com"]')).toHaveText(
      'Link'
    );
    await expect(container.locator('table')).toBeVisible();
    await expect(container.locator('ol > li')).toHaveCount(2);
    await expect(container.locator('ul > li')).toHaveCount(3);
  });
});
