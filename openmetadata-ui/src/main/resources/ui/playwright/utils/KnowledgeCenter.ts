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
import { expect, Locator, Page } from '@playwright/test';
import {
  SHORTCUTS,
  SLASH_COMMANDS,
} from '../constant/KnowledgeCenter.constant';
import { SidebarItem } from '../constant/sidebar';
import { TopicClass } from '../support/entity/TopicClass';
import { redirectToHomePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { sidebarClick } from './sidebar';

const ARTICLE_PAGE_ROUTE = '/context-center/articles/:fqn';
const FQN_PLACEHOLDER = ':fqn';

export const deletePage = async (
  page: Page,
  isQuickLink = false,
  entityFqn?: string
) => {
  if (!isQuickLink) {
    await page.getByTestId('manage-button').first().click();
    await page.getByTestId('delete-btn').click();
  }

  await expect(page.getByTestId('confirm-button')).toBeVisible();

  const deleteResponse = page.waitForResponse(
    `/api/v1/contextCenter/pages/*?recursive=${!isQuickLink}&hardDelete=${isQuickLink}`
  );

  // Register before clicking so we don't miss the response the app fires
  // naturally after redirect. Uses the browser session (no 401 risk).
  const hierarchyResponse = entityFqn
    ? page.waitForResponse(
        (response) =>
          response
            .url()
            .includes('/api/v1/contextCenter/pages/search/hierarchy') &&
          response.request().method() === 'GET'
      )
    : null;

  await page.getByTestId('confirm-button').click();

  const deleteRes = await deleteResponse;
  expect(deleteRes.status()).toBe(200);

  if (entityFqn && hierarchyResponse) {
    const listRes = await hierarchyResponse;
    expect(listRes.status()).toBe(200);
    const body = await listRes.json();
    expect(JSON.stringify(body)).not.toContain(entityFqn);
  }
};

export const addTitle = async (page: Page, title: string) => {
  const updateTitleResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/contextCenter/pages/') &&
      response.request().method() === 'PATCH'
  );

  await page.getByTestId('entity-header-display-name').fill(title);

  const res = await updateTitleResponse;
  expect(res.status()).toBe(200);

  await expect(page.getByTestId('content-change-state')).toHaveText('Saved');
};

export const updateBody = async (page: Page, body: string) => {
  await page.fill('.om-block-editor', body);
  const updateBodyResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/contextCenter/pages/') &&
      response.request().method() === 'PATCH'
  );
  const res = await updateBodyResponse;
  expect(res.status()).toBe(200);

  await expect(page.getByTestId('content-change-state')).toHaveText('Saved');
};

export const updateTags = async (
  page: Page,
  data: { tag: string; tagFqn: string }
) => {
  const updateKnowledgePage = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/contextCenter/pages/') &&
      response.request().method() === 'PATCH'
  );
  const tagsContainer = page.locator('[data-testid="tags-container"]').first();
  const addTagBtn = tagsContainer.getByTestId('add-tag');
  const editTagBtn = tagsContainer.getByTestId('edit-button');
  const isAdd = await addTagBtn.isVisible();
  if (isAdd) {
    await addTagBtn.click();
  } else {
    await editTagBtn.click();
  }

  await page.waitForSelector('[data-testid="tag-selector"] input', {
    state: 'visible',
  });
  const searchTagResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(`q=*${data.tag}*`) &&
      response.request().method() === 'GET'
  );
  await page.fill('[data-testid="tag-selector"] input', data.tag);
  await searchTagResponse;
  await page.click(`[data-testid='tag-${data.tagFqn}']`);

  await expect(
    page.locator(
      `[data-testid="tag-selector"] [data-testid="selected-tag-${data.tagFqn}"]`
    )
  ).toBeVisible();

  await page.locator('[data-testid="saveAssociatedTag"]').click();
  const response = await updateKnowledgePage;
  expect(response.status()).toBe(200);
};

export const updateDataAsset = async (
  page: Page,
  dataAsset: TopicClass,
  title: string
) => {
  const updateKnowledgePage = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/contextCenter/pages/') &&
      response.request().method() === 'PATCH'
  );
  await page.getByTestId('add-data-assets-container').click();

  await page.waitForSelector(
    '[data-testid="asset-select-list"] > .ant-select-selector input',
    { state: 'visible' }
  );
  await page.fill(
    '[data-testid="asset-select-list"] > .ant-select-selector input',
    dataAsset.entity.name
  );
  await page
    .locator('.ant-select-item-option-content', {
      hasText: dataAsset.entity.name,
    })
    .click();
  await page.locator('[data-testid="saveDataAssets"]').click();

  const response = await updateKnowledgePage;
  expect(response.status()).toBe(200);

  await page.waitForSelector(`[data-testid="${dataAsset.entity.name}"]`, {
    state: 'visible',
  });
  await page.click(`[data-testid="${dataAsset.entity.name}"]`);

  await page.getByRole('link', { name: title }).click();
};

export const updateVotes = async (page: Page) => {
  await page.click('[data-testid="up-vote-btn"]');

  await expect(page.locator('[data-testid="up-vote-count"]')).toHaveText('1');

  await page.click('[data-testid="down-vote-btn"]');

  await expect(page.locator('[data-testid="up-vote-count"]')).toHaveText('0');
  await expect(page.locator('[data-testid="down-vote-count"]')).toHaveText('1');
};

export const updateFollowers = async (page: Page) => {
  await page.click('[data-testid="entity-follow-button"]');

  await expect(
    page.locator('[data-testid="entity-follow-button"] > .ant-typography')
  ).toHaveText('1');
};

export const readArticleData = async (
  page: Page,
  data: {
    title: string;
    body: string;
    tagFqn: string;
  }
) => {
  await sidebarClick(page, SidebarItem.ARTICLE);
  await readArticleInHierarchy(page, data.title);
};

export const createQuickLink = async (
  page: Page,
  data: {
    displayName: string;
    url: string;
    description: string;
  },
  dataAsset: TopicClass
) => {
  await page.getByTestId('create-knowledge-page-btn').click();
  await page.getByTestId('create-quick-link-btn').click();

  const modal = page.locator('.quick-link-form-modal');

  await expect(
    modal.getByRole('heading', { name: 'Add Quick Link' })
  ).toBeVisible();

  await modal
    .locator('[data-testid="displayName"] input')
    .fill(data.displayName);
  await modal.locator('[data-testid="url"] input').fill(data.url);
  await modal
    .locator('[data-testid="description"] textarea')
    .fill(data.description);

  const assetInput = modal.locator(
    '[data-testid="related-entities-container"] input[role="combobox"]'
  );

  await assetInput.click();
  await assetInput.fill(dataAsset.entity.name);

  await expect(
    page.getByRole('option', { name: dataAsset.entity.name })
  ).toBeVisible();

  await page.getByRole('option', { name: dataAsset.entity.name }).click();
  await page.keyboard.press('Escape');

  await modal.getByRole('button', { name: 'Save' }).click();
};

export const readQuickLink = async (
  page: Page,
  quickLink: {
    displayName: string;
    description: string;
    url: string;
  }
) => {
  await page
    .locator(`[data-testid="knowledge-card-${quickLink.displayName}"]`)
    .scrollIntoViewIfNeeded();

  await expect(
    page.locator(
      `[data-testid="knowledge-card-${quickLink.displayName}"] [data-testid="knowledge-card-description"]`
    )
  ).toHaveText(quickLink.description);
  await expect(
    page.locator(
      `[data-testid="knowledge-card-${quickLink.displayName}"] [data-testid="knowledge-link"]`
    )
  ).toHaveAttribute('href', quickLink.url);
  await expect(
    page.locator(
      `[data-testid="knowledge-card-${quickLink.displayName}"] [data-testid="knowledge-link"]`
    )
  ).toHaveAttribute('target', '_blank');
};

export const updateQuickLink = async (
  page: Page,
  knowledgePageQuickLink: {
    displayName: string;
    updatedDisplayName: string;
    updatedUrl: string;
    updatedDescription: string;
    tag: string;
    tagFqn: string;
  }
) => {
  await page
    .locator(
      `[data-testid="knowledge-card-${knowledgePageQuickLink.displayName}"] [data-testid="edit-quick-link-btn"]`
    )
    .click();

  const modal = page.locator('.quick-link-form-modal');

  await expect(
    modal.getByRole('heading', {
      name: `Edit Quick Link ${knowledgePageQuickLink.displayName}`,
    })
  ).toBeVisible();

  await modal
    .locator('[data-testid="displayName"] input')
    .fill(knowledgePageQuickLink.updatedDisplayName);
  await modal
    .locator('[data-testid="url"] input')
    .fill(knowledgePageQuickLink.updatedUrl);

  const descriptionTextarea = modal.locator(
    '[data-testid="description"] textarea'
  );

  await descriptionTextarea.click();
  await descriptionTextarea.press('ControlOrMeta+a');
  await descriptionTextarea.fill(knowledgePageQuickLink.updatedDescription);

  const tagInput = modal.locator(
    '[data-testid="tags-container"] input[role="combobox"]'
  );

  await tagInput.click();
  await tagInput.fill(knowledgePageQuickLink.tag);

  await expect(
    page.getByRole('option', { name: knowledgePageQuickLink.tag })
  ).toBeVisible();

  await page.getByRole('option', { name: knowledgePageQuickLink.tag }).click();
  await page.keyboard.press('Escape');

  await modal.getByRole('button', { name: 'Save' }).click();

  await readQuickLink(page, {
    displayName: knowledgePageQuickLink.updatedDisplayName,
    description: knowledgePageQuickLink.updatedDescription,
    url: knowledgePageQuickLink.updatedUrl,
  });
};

export const readArticleInHierarchy = async (
  page: Page,
  articleTitle: string
) => {
  const article = page.locator(`[data-testid="page-node-${articleTitle}"]`);

  // Reset scroll position to top before starting pagination
  const hierarchyElement = page.locator(
    '[data-testid="knowledge-pages-hierarchy"]'
  );
  await hierarchyElement.hover();
  await page.mouse.wheel(0, -9999);

  await page.waitForTimeout(500);

  // Retry mechanism for pagination
  let elementCount = await article.count();
  let retryCount = 0;
  const maxRetries = 20;

  while (elementCount === 0 && retryCount < maxRetries) {
    await page.locator('[data-testid="knowledge-pages-hierarchy"]').hover();
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(500);

    // Create fresh locator and check if the article is now visible after this retry
    const freshArticle = page.getByTestId(`page-node-${articleTitle}`);
    const count = await freshArticle.count();

    // Check if the article is now visible after this retry
    elementCount = count;

    // If we found the element, validate it and break out of the loop
    if (count > 0) {
      await expect(freshArticle).toBeVisible();

      return; // Exit the function early since we found and validated the article
    }

    retryCount++;
  }
};

export const createMentionInConversation = async (
  page: Page,
  userName: string,
  message: string
) => {
  // Open conversation drawer
  await page.locator('[data-testid="conversation"]').click();
  await page.locator('.feed-drawer').waitFor({ state: 'visible' });

  // Click on Conversations tab
  await page.getByRole('tab', { name: 'Conversations' }).click();
  await page.waitForSelector('[data-testid="editor-wrapper"]');

  // Create message with mention
  const messageWithMention = `${message} @${userName}`;

  // Wait for mention suggestions to appear
  const userSuggestionsResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${userName}***`
  );

  // Type the message with mention
  await page
    .locator('[data-testid="editor-wrapper"] [contenteditable="true"]')
    .click();
  await page
    .locator('[data-testid="editor-wrapper"] [contenteditable="true"]')
    .fill(messageWithMention);

  await userSuggestionsResponse;

  // Select the mention from suggestions
  await page.locator(`[data-value="@${userName}"]`).first().click();

  // Send the message
  const feedResponse = page.waitForResponse('/api/v1/feed');
  await page.locator('[data-testid="send-button"]').click();
  await feedResponse;

  // Verify the message with mention is visible
  await expect(page.locator(`text=${messageWithMention}`)).toBeVisible();

  return messageWithMention;
};

export const verifyNotificationAndClick = async (
  page: Page,
  expectedUserName: string,
  entityName: string
) => {
  // Click on notification bell
  await page.locator('[data-testid="task-notifications"]').click();

  // Wait for notification dropdown to appear
  await page.waitForSelector('[data-testid="notification-heading"]', {
    state: 'visible',
  });

  // Click on Mentions tab
  const mentionsTabResponse = page.waitForResponse(
    '/api/v1/feed?userId=*&filterType=MENTIONS'
  );

  await page.getByRole('tab', { name: 'Mentions' }).click();
  await mentionsTabResponse;

  // Verify the notification contains the mentioned user and entity type
  await expect(
    page.getByTestId(`notification-item-${entityName}`).nth(1)
  ).toContainText(expectedUserName);

  await expect(
    page.getByTestId(`notification-item-${entityName}`).nth(1)
  ).toContainText(entityName);

  // Click on the notification to navigate to the entity
  await page.getByTestId(`notification-link-${entityName}`).nth(1).click();
};

export const getKnowledgePageCardByIndex = async (
  page: Page,
  index: number
) => {
  const listing = page.getByTestId('knowledge-page-listing');
  const cards = listing.locator('[data-testid^="knowledge-card-"]');
  await expect(cards.nth(index)).toBeAttached();
  const card = cards.nth(index);
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  return card;
};
/**
 * Derives the entity identifier used by getLink() in KnowledgePageUtils:
 *   data-testid = `${prefix}-${displayName || fullyQualifiedName}`
 * The || (not ??) operator means an empty-string displayName also falls back
 * to the FQN. When displayName is empty/null the card shows "Untitled"
 * (i18n placeholder), but the widget testid uses the FQN. This helper
 * mirrors that logic and returns the correct value for testid lookups.
 */
export const getKnowledgePageCardEntityIdentifier = async (
  card: Locator
): Promise<string> => {
  const href =
    (await card.getByTestId('knowledge-page-link').getAttribute('href')) ?? '';
  const fqn = href.split('/knowledge-center/').pop() ?? '';
  const displayText = (
    await card.getByTestId('knowledge-card-title').textContent()
  )?.trim();
  return displayText && displayText !== 'Untitled' ? displayText : fqn;
};

export const toggleKnowledgePageBookmark = async (
  page: Page,
  bookmarkBtn: Locator,
) => {
  const bookmarkResponse = page.waitForResponse((response) => {
    const url = response.url();
    return (
      url.includes('/api/v1/contextCenter/pages') && url.includes('/followers')
    );
  });

  await bookmarkBtn.click();
  const bookmarkRes = await bookmarkResponse;
  expect(bookmarkRes.status()).toBe(200);
  await waitForAllLoadersToDisappear(page);
};

export const createNewKnowledgePageArticle = async (
  page: Page,
  articleTitle: string
) => {
  const createKnowledgePage = page.waitForResponse(
    '/api/v1/contextCenter/pages'
  );

  await sidebarClick(page, SidebarItem.ARTICLE);
  await page
    .locator('[data-testid="left-panel"]')
    .getByTestId('add-knowledge-page-btn')
    .click();
  await page.getByRole('menuitem', { name: 'Article' }).click();
  await createKnowledgePage;

  await addTitle(page, articleTitle);

  return { articleTitle };
};

export const getEditor = async (page: Page, waitForWrapper = false) => {
  if (waitForWrapper) {
    await waitForAllLoadersToDisappear(page);
    await page.waitForSelector('#block-editor-wrapper', {
      state: 'visible',
    });
  }

  await page.waitForSelector('.ProseMirror[contenteditable="true"]', {
    state: 'visible',
  });
  return page.locator('.ProseMirror[contenteditable="true"]').first();
};

export const executeSlashCommand = async (
  page: Page,
  command: string
): Promise<void> => {
  await page.keyboard.type(`/${command}`);
  await page.keyboard.press(SHORTCUTS.enter);
};

export const moveToNewLine = async (
  page: Page,
  editor: Locator,
  exitList = false
): Promise<void> => {
  await editor.click();
  await page.keyboard.press(SHORTCUTS.end);
  await page.keyboard.press(SHORTCUTS.enter);
  if (exitList) {
    await page.keyboard.press(SHORTCUTS.backspace);
  }
  await page.keyboard.press(SHORTCUTS.enter);
};

export const moveToNewParagraph = async (
  page: Page,
  editor: Locator
): Promise<void> => {
  await editor.click();
  await page.keyboard.press(SHORTCUTS.end);
  await page.keyboard.press(SHORTCUTS.enter);
  await page.keyboard.press(SHORTCUTS.enter);
  await page.keyboard.press(SHORTCUTS.enter);
};

export const selectLastWord = async (
  page: Page,
  wordCount = 1,
  editor?: Locator
): Promise<void> => {
  if (editor) {
    await editor.click();
    await expect(editor).toBeFocused();
  }
  await page.keyboard.press(SHORTCUTS.end);
  if (editor) {
    await expect(editor).toBeFocused();
  }

  for (let i = 0; i < wordCount; i++) {
    await page.keyboard.press(SHORTCUTS.selectWord);
    if (editor && i < wordCount - 1) {
      await expect(editor).toBeFocused();
    }
  }
};

export const applyTextFormatting = async (
  page: Page,
  format: 'bold' | 'italic' | 'code'
): Promise<void> => {
  await page.keyboard.press(SHORTCUTS[format]);
};

export const selectAllText = async (page: Page) => {
  await page.keyboard.press(SHORTCUTS.selectAll);
};

export const selectEditorLastWord = async (page: Page) => {
  await page.keyboard.press(SHORTCUTS.selectWord);
};

export const createHeading = async (
  page: Page,
  level: 1 | 2 | 3,
  text: string
): Promise<void> => {
  await page.keyboard.press(SHORTCUTS.enter);
  const headingCommand =
    level === 1
      ? SLASH_COMMANDS.h1
      : level === 2
      ? SLASH_COMMANDS.h2
      : SLASH_COMMANDS.h3;
  await executeSlashCommand(page, headingCommand);
  await page.keyboard.type(text);
};

export const createListItems = async (
  page: Page,
  items: string[]
): Promise<void> => {
  for (const item of items) {
    await page.keyboard.type(item);
    await page.keyboard.press(SHORTCUTS.enter);
  }
};

export const clearCodeFormatting = async (
  page: Page,
  editor: Locator
): Promise<void> => {
  await page.keyboard.type('X');

  const testInCode = editor.locator('code').filter({ hasText: 'X' });
  const isInCode = (await testInCode.count()) > 0;

  if (isInCode) {
    await page.keyboard.press(SHORTCUTS.selectWord);

    await page.waitForSelector('.menu-wrapper', {
      state: 'visible',
    });

    const codeButton = page.getByRole('button', { name: 'Inline code' });
    await expect(codeButton).toBeVisible();
    await codeButton.click();
  }

  await page.keyboard.press(SHORTCUTS.backspace);
};

export const createLink = async (
  page: Page,
  editor: Locator,
  linkText: string,
  url: string
): Promise<void> => {
  await clearCodeFormatting(page, editor);

  await page.keyboard.type(linkText);

  await selectLastWord(page, linkText.split(' ').length, editor);

  await page.waitForSelector('.menu-wrapper', {
    state: 'visible',
  });

  const linkButton = page.getByTestId('center-panel').getByRole('button', { name: 'Link' });
  await expect(linkButton).toBeVisible();
  await linkButton.click();

  const linkDialog = page.getByRole('dialog', { name: 'Add link' });
  await expect(linkDialog).toBeVisible();

  const linkInput = page.locator('#href');
  await expect(linkInput).toBeVisible();
  await linkInput.fill(url);

  const saveButton = linkDialog.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeVisible();
  await saveButton.click();
};

export const waitForAutoSave = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('content-change-state')).toHaveText('Saved', {
    timeout: 15000,
  });
};

export const verifyTextFormatting = async (
  editor: Locator,
  text: string,
  format: 'bold' | 'italic' | 'code'
) => {
  const formatTag = {
    bold: 'strong',
    italic: 'em',
    code: 'code',
  }[format];

  await expect(editor.locator(formatTag, { hasText: text })).toBeVisible();
};

export const undo = async (page: Page): Promise<void> => {
  await page.keyboard.press(SHORTCUTS.undo);
};

export const redo = async (page: Page): Promise<void> => {
  await page.keyboard.press(SHORTCUTS.redo);
};

export const selectAll = async (page: Page): Promise<void> => {
  await page.keyboard.press(SHORTCUTS.selectAll);
};

export const copyContent = async (page: Page): Promise<void> => {
  await page.keyboard.press(SHORTCUTS.copy);
};

export const pasteContent = async (page: Page): Promise<void> => {
  await page.keyboard.press(SHORTCUTS.paste);
};

export const createNestedListItems = async (
  page: Page,
  parentItems: string[],
  nestedItems: string[]
): Promise<void> => {
  for (let i = 0; i < parentItems.length; i++) {
    await page.keyboard.type(parentItems[i]);
    await page.keyboard.press(SHORTCUTS.enter);

    if (i === parentItems.length - 1) {
      await page.keyboard.press(SHORTCUTS.tab);

      for (const nestedItem of nestedItems) {
        await page.keyboard.type(nestedItem);
        await page.keyboard.press(SHORTCUTS.enter);
      }
    }
  }
};

export const verifyNestedList = async (
  editor: Locator,
  parentText: string,
  nestedText: string
): Promise<void> => {
  await expect(
    editor.locator('li').filter({ hasText: parentText })
  ).toBeVisible();

  const parentLi = editor.locator('li').filter({ hasText: parentText });
  const nestedItem = parentLi.locator('li').filter({ hasText: nestedText });
  await expect(nestedItem).toBeVisible();
};

export const verifyContentPersistence = async (
  page: Page,
  expectedTexts: string[]
): Promise<void> => {
  await waitForAutoSave(page);

  await page.reload();
  await waitForAllLoadersToDisappear(page);

  const editor = await getEditor(page, true);
  await editor.waitFor({ state: 'visible' });

  for (const text of expectedTexts) {
    await expect(page.getByText(text)).toBeVisible();
  }
};

export const createCodeBlock = async (
  page: Page,
  code: string
): Promise<void> => {
  await executeSlashCommand(page, SLASH_COMMANDS.codeBlock);
  await page.keyboard.type(code);
};

export const verifyCodeBlock = async (
  editor: Locator,
  code: string
): Promise<void> => {
  const codeBlock = editor.locator('pre code').filter({ hasText: code });
  await expect(codeBlock).toBeVisible();
};

export const createTaskListItems = async (
  page: Page,
  tasks: string[]
): Promise<void> => {
  for (let i = 0; i < tasks.length; i++) {
    await page.keyboard.type(tasks[i]);
    if (i < tasks.length - 1) {
      await page.keyboard.press(SHORTCUTS.enter);
    }
  }
};

export const verifyTaskList = async (
  editor: Locator,
  taskText: string
): Promise<void> => {
  const taskItem = editor.locator('li').filter({ hasText: taskText });
  await expect(taskItem).toBeVisible();

  const checkbox = taskItem.locator('input[type="checkbox"]');
  await expect(checkbox).toBeVisible();
};

export const toggleTask = async (
  page: Page,
  editor: Locator,
  taskText: string
): Promise<void> => {
  const taskItem = editor.locator('li').filter({ hasText: taskText });
  const checkbox = taskItem.locator('input[type="checkbox"]');
  await checkbox.click();
  await page.waitForTimeout(100);
};

export const createCallout = async (
  page: Page,
  text: string
): Promise<void> => {
  await executeSlashCommand(page, SLASH_COMMANDS.callout);
  await page.waitForTimeout(200);
  await page.keyboard.type(text);
};

export const verifyCallout = async (
  editor: Locator,
  text: string
): Promise<void> => {
  const callout = editor
    .locator('[data-type="callout"]')
    .filter({ hasText: text });
  await expect(callout).toBeVisible();
};

export const createTable = async (page: Page): Promise<void> => {
  await executeSlashCommand(page, SLASH_COMMANDS.table);
  await page.waitForTimeout(300);
};

export const verifyTable = async (editor: Locator): Promise<void> => {
  const table = editor.locator('table');
  await expect(table).toBeVisible();
};

export const typeInTableCell = async (
  page: Page,
  row: number,
  col: number,
  text: string
): Promise<void> => {
  const editor = await getEditor(page);
  const table = editor.locator('table');
  const rows = table.locator('tr');
  const targetRow = rows.nth(row);
  const cells = targetRow.locator('td, th');
  const targetCell = cells.nth(col);

  await targetCell.click();
  await page.keyboard.type(text);
};

export const navigateToArticle = async (page: Page, articleFqn: string) => {
  // Wait for GET API response when navigating to the article
  const getArticleResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(`/api/v1/contextCenter/pages/name/${articleFqn}`) &&
      response.status() === 200
  );

  const articlePath = ARTICLE_PAGE_ROUTE.replace(FQN_PLACEHOLDER, articleFqn);
  await page.goto(articlePath);
  await getArticleResponse;
  await waitForAllLoadersToDisappear(page);
  await getArticleResponse;
};

export const navigateToKnowledgeCenter = async (page: Page) => {
  await redirectToHomePage(page);

  const knowledgeCenterResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/contextCenter/pages') ||
      response.url().includes('/knowledge-center')
  );

  await sidebarClick(page, SidebarItem.ARTICLE);
  await knowledgeCenterResponse;
};
