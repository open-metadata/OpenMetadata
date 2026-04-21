import { expect, Page, test } from '@playwright/test';
import {
  SHORTCUTS,
  SLASH_COMMANDS,
} from '../../constant/KnowledgeCenter.constant';
import { KnowledgeCenterResponseDataType } from '../../support/entity/KnowledgeCenter.interface';
import {
  applyTextFormatting,
  copyContent,
  createCallout,
  createCodeBlock,
  createHeading,
  createLink,
  createListItems,
  createNestedListItems,
  createTable,
  createTaskListItems,
  executeSlashCommand,
  getEditor,
  moveToNewLine,
  moveToNewParagraph,
  navigateToArticle,
  pasteContent,
  redo,
  selectAll,
  selectAllText,
  selectLastWord,
  toggleTask,
  typeInTableCell,
  undo,
  verifyCallout,
  verifyCodeBlock,
  verifyContentPersistence,
  verifyNestedList,
  verifyTable,
  verifyTaskList,
  verifyTextFormatting,
} from '../../utils/KnowledgeCenter';

export const runSlashCommandsAndBasicBlocksTest = async (
  page: Page,
  article: KnowledgeCenterResponseDataType
) => {
  await navigateToArticle(page, article.fullyQualifiedName);
  const editor = await getEditor(page, true);
  await editor.waitFor({ state: 'visible' });

  await test.step('Test Headings (H1, H2, H3)', async () => {
    await editor.click();
    await createHeading(page, 1, 'Heading 1');
    await expect(
      page.getByRole('heading', { name: 'Heading 1', level: 1 })
    ).toBeVisible();

    await page.keyboard.press(SHORTCUTS.enter);
    await createHeading(page, 2, 'Heading 2');
    await expect(
      page.getByRole('heading', { name: 'Heading 2', level: 2 })
    ).toBeVisible();

    await page.keyboard.press(SHORTCUTS.enter);
    await createHeading(page, 3, 'Heading 3');
    await expect(
      page.getByRole('heading', { name: 'Heading 3', level: 3 })
    ).toBeVisible();
  });

  await test.step('Test Bullet List', async () => {
    await moveToNewParagraph(page, editor);
    await executeSlashCommand(page, SLASH_COMMANDS.bullet);
    await expect(editor.locator('ul')).toBeVisible();
    await createListItems(page, ['Item 1', 'Item 2', 'Item 3']);

    await expect(page.getByText('Item 1')).toBeVisible();
    await expect(page.getByText('Item 2')).toBeVisible();
    await expect(page.getByText('Item 3')).toBeVisible();

    const bulletList = editor.locator('ul').filter({ hasText: 'Item 1' });
    await expect(bulletList).toBeVisible();
  });

  await test.step('Test Numbered List', async () => {
    await moveToNewParagraph(page, editor);
    await executeSlashCommand(page, SLASH_COMMANDS.numbered);
    await expect(editor.locator('ol')).toBeVisible();
    await createListItems(page, ['First item', 'Second item', 'Third item']);

    await expect(page.getByText('First item')).toBeVisible();
    await expect(page.getByText('Second item')).toBeVisible();
    await expect(page.getByText('Third item')).toBeVisible();
    const numberedList = editor.locator('ol').filter({ hasText: 'First item' });
    await expect(numberedList).toBeVisible();
  });

  await test.step('Test Divider', async () => {
    await moveToNewLine(page, editor, true);
    await executeSlashCommand(page, SLASH_COMMANDS.divider);
    const divider = editor.locator('hr');
    await expect(divider).toBeVisible();
  });

  await test.step('Test Quote/Blockquote', async () => {
    await moveToNewLine(page, editor);
    await executeSlashCommand(page, SLASH_COMMANDS.quote);
    await expect(editor.locator('blockquote')).toBeVisible();
    await page.keyboard.type('This is a quote');

    await expect(page.getByText('This is a quote')).toBeVisible();

    // Verify it's in a blockquote element
    const blockquote = editor.locator('blockquote');
    const blockquoteWithText = blockquote.filter({
      hasText: 'This is a quote',
    });
    await expect(blockquoteWithText.first()).toBeVisible();

    // Also verify it's NOT in a list
    const textInList = editor
      .locator('ol, ul')
      .filter({ hasText: 'This is a quote' });
    const listCount = await textInList.count();
    expect(listCount).toBe(0);
  });
};

export const runTextFormattingTest = async (
  page: Page,
  article: KnowledgeCenterResponseDataType
) => {
  await navigateToArticle(page, article.fullyQualifiedName);
  const editor = await getEditor(page);
  await editor.waitFor({ state: 'visible' });

  await test.step('Apply bold formatting', async () => {
    await editor.click();
    await page.keyboard.type('Normal text');
    await page.keyboard.press(SHORTCUTS.enter);
    await page.keyboard.type('Bold text');

    await expect(page.getByText('Bold text')).toBeVisible();

    await selectAllText(page);

    await applyTextFormatting(page, 'bold');

    await verifyTextFormatting(editor, 'Bold text', 'bold');

    await page.keyboard.press(SHORTCUTS.redo);
    await expect(page.getByText('Bold text')).toBeVisible();
  });

  await test.step('Test Italic formatting', async () => {
    await page.keyboard.press(SHORTCUTS.enter);
    await page.keyboard.type('Normal text ');
    await page.keyboard.press(SHORTCUTS.enter);
    await page.keyboard.type('Italic text');

    await expect(page.getByText('Italic text')).toBeVisible();
    await page.getByText('Italic text').selectText();
    await applyTextFormatting(page, 'italic');

    await expect(page.getByText('Italic text')).toBeVisible();
    await verifyTextFormatting(editor, 'Italic text', 'italic');
  });

  await test.step('Test Inline Code', async () => {
    await page.keyboard.press(SHORTCUTS.enter);
    await page.keyboard.type('inline code');

    await expect(page.getByText('inline code')).toBeVisible();
    await page.getByText('inline code').selectText();
    await applyTextFormatting(page, 'code');

    await expect(page.getByText('inline code')).toBeVisible();
    await verifyTextFormatting(editor, 'inline code', 'code');
  });

  await test.step('Test Link', async () => {
    await page.keyboard.press(SHORTCUTS.enter);
    await createLink(
      page,
      editor,
      'Visit OpenMetadata',
      'https://open-metadata.org'
    );

    const link = page.getByRole('link', { name: 'Visit OpenMetadata' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://open-metadata.org');
  });
};

export const runEditorOperationsTest = async (
  page: Page,
  article: KnowledgeCenterResponseDataType
) => {
  await navigateToArticle(page, article.fullyQualifiedName);
  const editor = await getEditor(page);
  await editor.waitFor({ state: 'visible' });

  await test.step('Test Undo/Redo', async () => {
    await editor.click();

    await page.keyboard.press(SHORTCUTS.enter);
    await page.keyboard.type('First text');
    await expect(page.getByText('First text')).toBeVisible();
    await undo(page);
    await expect(page.getByText('First text')).not.toBeVisible();

    await editor.click();
    await redo(page);

    await expect(page.getByText('First text')).toBeVisible();
  });

  await test.step('Test Copy/Paste', async () => {
    await page.keyboard.press(SHORTCUTS.enter);
    await page.keyboard.type('Text to copy');
    await expect(page.getByText('Text to copy')).toBeVisible();
    await selectAll(page);

    await copyContent(page);

    await page.keyboard.press(SHORTCUTS.enter);

    await pasteContent(page);
    const pastedText = page.getByText('Text to copy');
    const count = await pastedText.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  await test.step('Test Select All', async () => {
    await page.keyboard.press(SHORTCUTS.enter);
    await page.keyboard.type('Select all test');
    await expect(page.getByText('Select all test')).toBeVisible();

    await selectAll(page);
    await applyTextFormatting(page, 'bold');
    await verifyTextFormatting(editor, 'Select all test', 'bold');
  });
};

export const runNestedListsTest = async (
  page: Page,
  article: KnowledgeCenterResponseDataType
) => {
  await navigateToArticle(page, article.fullyQualifiedName);
  const editor = await getEditor(page);
  await editor.waitFor({ state: 'visible' });

  await test.step('Test Nested Bullet List', async () => {
    await moveToNewParagraph(page, editor);
    await executeSlashCommand(page, SLASH_COMMANDS.bullet);
    await expect(editor.locator('ul')).toBeVisible();

    await createNestedListItems(
      page,
      ['Parent Item 1', 'Parent Item 2'],
      ['Nested Item 1', 'Nested Item 2']
    );

    await expect(page.getByText('Parent Item 1')).toBeVisible();
    await expect(page.getByText('Parent Item 2')).toBeVisible();

    await verifyNestedList(editor, 'Parent Item 2', 'Nested Item 1');
    await verifyNestedList(editor, 'Parent Item 2', 'Nested Item 2');
  });

  await test.step('Test Nested Numbered List', async () => {
    await moveToNewParagraph(page, editor);
    await executeSlashCommand(page, SLASH_COMMANDS.numbered);
    await expect(editor.locator('ol')).toBeVisible();

    await createNestedListItems(
      page,
      ['First Parent', 'Second Parent'],
      ['First Nested', 'Second Nested']
    );

    await expect(page.getByText('First Parent')).toBeVisible();
    await expect(page.getByText('Second Parent')).toBeVisible();

    await verifyNestedList(editor, 'Second Parent', 'First Nested');
    await verifyNestedList(editor, 'Second Parent', 'Second Nested');
  });
};

export const runContentPersistenceTest = async (
  page: Page,
  article: KnowledgeCenterResponseDataType
) => {
  await navigateToArticle(page, article.fullyQualifiedName);
  const editor = await getEditor(page);
  await editor.waitFor({ state: 'visible' });

  await test.step('Create content and verify persistence after reload', async () => {
    await editor.click();
    await createHeading(page, 1, 'Persistent Heading');
    await page.keyboard.press(SHORTCUTS.enter);

    await page.keyboard.type('Persistent paragraph text');
    await page.keyboard.press(SHORTCUTS.enter);

    await executeSlashCommand(page, SLASH_COMMANDS.bullet);
    await expect(editor.locator('ul')).toBeVisible();
    await createListItems(page, ['Persistent Item 1', 'Persistent Item 2']);
    await page.keyboard.press(SHORTCUTS.enter);

    await page.keyboard.type('Bold persistent text');
    await expect(page.getByText('Bold persistent text')).toBeVisible();
    await selectLastWord(page, 3, editor);
    await applyTextFormatting(page, 'bold');

    await verifyContentPersistence(page, [
      'Persistent Heading',
      'Persistent paragraph text',
      'Persistent Item 1',
      'Persistent Item 2',
      'Bold persistent text',
    ]);
  });
};

export const runAdvancedBlocksTest = async (
  page: Page,
  article: KnowledgeCenterResponseDataType
) => {
  await navigateToArticle(page, article.fullyQualifiedName);
  const editor = await getEditor(page);
  await editor.waitFor({ state: 'visible' });

  await test.step('Test Code Block', async () => {
    await editor.click();
    await moveToNewParagraph(page, editor);

    await createCodeBlock(
      page,
      'const test = "code block";\nconsole.log(test);'
    );

    await verifyCodeBlock(editor, 'const test = "code block"');
  });

  await test.step('Test Task List', async () => {
    await moveToNewParagraph(page, editor);
    await executeSlashCommand(page, SLASH_COMMANDS.task);
    await expect(editor.locator('input[type="checkbox"]')).toBeVisible();

    await createTaskListItems(page, ['Task 1', 'Task 2', 'Task 3']);

    await verifyTaskList(editor, 'Task 1');
    await verifyTaskList(editor, 'Task 2');
    await verifyTaskList(editor, 'Task 3');

    await toggleTask(page, editor, 'Task 1');
    const taskCheckbox = editor
      .locator('li')
      .filter({ hasText: 'Task 1' })
      .locator('input[type="checkbox"]');
    await expect(taskCheckbox).toBeChecked();
  });

  await test.step('Test Callout', async () => {
    await moveToNewParagraph(page, editor);

    await createCallout(page, 'This is an important callout message');

    await verifyCallout(editor, 'This is an important callout message');
  });

  await test.step('Test Table', async () => {
    await moveToNewParagraph(page, editor);

    await createTable(page);
    await verifyTable(editor);

    await typeInTableCell(page, 0, 0, 'Header 1');
    await expect(
      editor.locator('table td, table th').filter({ hasText: 'Header 1' })
    ).toBeVisible();
    await typeInTableCell(page, 0, 1, 'Header 2');
    await expect(
      editor.locator('table td, table th').filter({ hasText: 'Header 2' })
    ).toBeVisible();
    await typeInTableCell(page, 1, 0, 'Row 1 Col 1');
    await expect(
      editor.locator('table td, table th').filter({ hasText: 'Row 1 Col 1' })
    ).toBeVisible();
    await typeInTableCell(page, 1, 1, 'Row 1 Col 2');
  });
};
