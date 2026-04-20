import {
  createNewPage,
  redirectToHomePage,
} from '../../utils/common';
import { KnowledgeCenterClass } from '../../support/entity/KnowledgeCenterClass';
import {
  runSlashCommandsAndBasicBlocksTest,
  runTextFormattingTest,
  runEditorOperationsTest,
  runNestedListsTest,
  runContentPersistenceTest,
  runAdvancedBlocksTest,
} from './KnowledgeCenterTextEditor.common';
import { test } from '../fixtures/pages';
import { performAdminLogin } from '../../utils/admin';

test.describe('Knowledge Center - Text Editor (Admin Role)', () => {
  const knowledgeCenter = new KnowledgeCenterClass();

  test.use({
    storageState: 'playwright/.auth/admin.json',
  });

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);
    const { apiContext, afterAction } = await createNewPage(browser);
    await knowledgeCenter.create(apiContext, 6);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Rich Text Editor - Slash Commands and Basic Blocks', async ({
    page,
  }) => {
    const article = knowledgeCenter.knowledgePages[0];
    await runSlashCommandsAndBasicBlocksTest(page, article);
  });

  test('Rich Text Editor - Text Formatting', async ({ page }) => {
    const article = knowledgeCenter.knowledgePages[1];
    await runTextFormattingTest(page, article);
  });

  test('Rich Text Editor - Editor Operations', async ({ page }) => {
    const article = knowledgeCenter.knowledgePages[2];
    await runEditorOperationsTest(page, article);
  });

  test('Rich Text Editor - Nested Lists', async ({ page }) => {
    const article = knowledgeCenter.knowledgePages[3];
    await runNestedListsTest(page, article);
  });

  test('Rich Text Editor - Content Persistence', async ({ page }) => {
    const article = knowledgeCenter.knowledgePages[4];
    await runContentPersistenceTest(page, article);
  });

  test('Rich Text Editor - Advanced Blocks', async ({ page }) => {
    const article = knowledgeCenter.knowledgePages[5];
    await runAdvancedBlocksTest(page, article);
  });
});

test.describe('Knowledge Center - Text Editor (Data Consumer Role)', () => {
  const knowledgeCenter = new KnowledgeCenterClass();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await knowledgeCenter.create(apiContext, 6);
    await afterAction();
  });

  test.beforeEach(async ({ dataConsumerPage }) => {
    await redirectToHomePage(dataConsumerPage);
  });

  test('Rich Text Editor - Slash Commands and Basic Blocks', async ({
    dataConsumerPage,
  }) => {
    const article = knowledgeCenter.knowledgePages[0];
    await runSlashCommandsAndBasicBlocksTest(dataConsumerPage, article);
  });

  test('Rich Text Editor - Text Formatting', async ({ dataConsumerPage }) => {
    const article = knowledgeCenter.knowledgePages[1];
    await runTextFormattingTest(dataConsumerPage, article);
  });

  test('Rich Text Editor - Editor Operations', async ({ dataConsumerPage }) => {
    const article = knowledgeCenter.knowledgePages[2];
    await runEditorOperationsTest(dataConsumerPage, article);
  });

  test('Rich Text Editor - Nested Lists', async ({ dataConsumerPage }) => {
    const article = knowledgeCenter.knowledgePages[3];
    await runNestedListsTest(dataConsumerPage, article);
  });

  test('Rich Text Editor - Content Persistence', async ({
    dataConsumerPage,
  }) => {
    const article = knowledgeCenter.knowledgePages[4];
    await runContentPersistenceTest(dataConsumerPage, article);
  });

  test('Rich Text Editor - Advanced Blocks', async ({ dataConsumerPage }) => {
    const article = knowledgeCenter.knowledgePages[5];
    await runAdvancedBlocksTest(dataConsumerPage, article);
  });
});

test.describe('Knowledge Center - Text Editor (Data Steward Role)', () => {
  const knowledgeCenter = new KnowledgeCenterClass();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await knowledgeCenter.create(apiContext, 6);
    await afterAction();
  });

  test.beforeEach(async ({ dataStewardPage }) => {
    await redirectToHomePage(dataStewardPage);
  });

  test('Rich Text Editor - Slash Commands and Basic Blocks', async ({
    dataStewardPage,
  }) => {
    const article = knowledgeCenter.knowledgePages[0];
    await runSlashCommandsAndBasicBlocksTest(dataStewardPage, article);
  });

  test('Rich Text Editor - Text Formatting', async ({ dataStewardPage }) => {
    const article = knowledgeCenter.knowledgePages[1];
    await runTextFormattingTest(dataStewardPage, article);
  });

  test('Rich Text Editor - Editor Operations', async ({ dataStewardPage }) => {
    const article = knowledgeCenter.knowledgePages[2];
    await runEditorOperationsTest(dataStewardPage, article);
  });

  test('Rich Text Editor - Nested Lists', async ({ dataStewardPage }) => {
    const article = knowledgeCenter.knowledgePages[3];
    await runNestedListsTest(dataStewardPage, article);
  });

  test('Rich Text Editor - Content Persistence', async ({
    dataStewardPage,
  }) => {
    const article = knowledgeCenter.knowledgePages[4];
    await runContentPersistenceTest(dataStewardPage, article);
  });

  test('Rich Text Editor - Advanced Blocks', async ({ dataStewardPage }) => {
    const article = knowledgeCenter.knowledgePages[5];
    await runAdvancedBlocksTest(dataStewardPage, article);
  });
});
