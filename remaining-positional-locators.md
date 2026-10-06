# Remaining `om-playwright/no-positional-locator` sites

Total: **506** across **146** files.


## e2e/Features/ActivityAPI.spec.ts  (2)

- `98` — `const entityLink = feedItem.locator('a[href*="/table/"]').first();`
- `356` — `page .getByTestId('popover-content') .filter({ hasText: adminDisplayName }) .last()`

## e2e/Features/ActivityFeed.spec.ts  (12)

- `398` — `const seededCard = widget .getByTestId('message-container') .filter({ hasText: ownedActivityMarker }) .first();`
- `425` — `const seededCard = widget .getByTestId('message-container') .filter({ hasText: ownedActivityMarker }) .first();`
- `464` — `const seededCard = widget .getByTestId('message-container') .filter({ hasText: ownedActivityMarker }) .first();`
- `620` — `await user1Page .locator(`[data-value="@${adminUser.responseData.name}"]`) .first()`
- `706` — `const firstNotificationItem = mentionsList .locator('li.ant-list-item.notification-dropdown-list-btn') .first();`
- `770` — `const emojiButton = message .locator('[data-testid="emoji-button"]') .last();`
- `874` — `const seededThread = page .locator( '[data-testid="message-container"], [data-testid="feed-reply-card"]' ) .filter({ hasText: CHINESE_MENTION_THREAD_M`
- `896` — `return editorLocator.first();`
- `911` — `const hashtagItem = page .locator('.hashtag-item') .filter({ hasText: label }) .first();`
- `1284` — `await expect(items.first().locator('.is-active')).toBeVisible();`
- `1300` — `const activityCard = feedList.filter({ hasText: activityMarker }).first();`
- `1307` — `await panel.locator('[data-testid="add-reactions"]').first().click();`

## e2e/Features/ActivityStream.spec.ts  (1)

- `113` — `const descriptionEditor = page .locator( '[data-testid="editor"] .ProseMirror, [data-testid="markdown-editor"] .ql-editor, .toastui-editor-contents' )`

## e2e/Features/AdvancedSearch.spec.ts  (2)

- `489` — `const dropdown = page .locator('[role="listbox"]') .filter({ hasText: EntityStatus.Approved }) .last();`
- `1706` — `const dropdown = page.locator('[role="listbox"]:visible').last();`

## e2e/Features/BulkEditEntity.spec.ts  (6)

- `221` — `await page .locator('.rdg-cell[role="gridcell"]') .first()`
- `353` — `await page .locator('.rdg-cell[role="gridcell"]') .first()`
- `500` — `await page .locator('.rdg-cell[role="gridcell"]') .first()`
- `626` — `await page .locator('.rdg-cell[role="gridcell"]') .first()`
- `638` — `const activeDescriptionCell = page .locator(RDG_ACTIVE_CELL_SELECTOR) .first();`
- `880` — `await page.locator('.rdg-cell[role="gridcell"]').first().click();`

## e2e/Features/BulkImport.spec.ts  (1)

- `927` — `const columnNameLink = page .getByTestId('column-name') .first()`

## e2e/Features/BulkImportWithDotInName.spec.ts  (1)

- `691` — `const descriptionCell1 = page .locator('.rdg-row') .nth(0)`

## e2e/Features/ChangeSummaryBadge.spec.ts  (6)

- `115` — `const badge = descriptionContainer .getByTestId('ai-suggested-badge') .first();`
- `123` — `const badge = page .getByTestId('asset-description-container') .getByTestId('ai-suggested-badge') .first();`
- `149` — `const badge = page .locator('.entity-summary-panel-container') .getByTestId('ai-suggested-badge') .first();`
- `201` — `const badge = page .locator('.entity-summary-panel-container') .getByTestId('ai-suggested-badge') .first();`
- `271` — `const badge = descriptionContainer .getByTestId('automated-badge') .first();`
- `336` — `const badge = descriptionContainer .getByTestId('propagated-badge') .first();`

## e2e/Features/ColumnBulkOperations.spec.ts  (6)

- `138` — `return page .locator(`[data-row-id="${rowId}"]`) .first()`
- `588` — `const groupRow = page .locator(`[data-row-id="${sharedColumnName}"]`) .first();`
- `824` — `const firstNameCell = page.getByTestId('column-name-cell').first();`
- `864` — `const editor = drawer.locator(descriptionBox).first();`
- `1064` — `const expandButton = structRow.getByRole('button').first();`
- `1089` — `const expandButton = structRow.getByRole('button').first();`

## e2e/Features/ColumnBulkOperationsTagsGlossary.spec.ts  (2)

- `144` — `return page .locator(`[data-row-id="${rowId}"]`) .first()`
- `209` — `const tagInput = tagsField .getByTestId('tag-selector') .locator('input') .first();`

## e2e/Features/Container.spec.ts  (1)

- `269` — `const copyButton = page.getByTestId('copy-column-link-button').first();`

## e2e/Features/ContextCenterArticles.spec.ts  (7)

- `1436` — `page.getByTestId('popover-content').filter({ hasText: /admin/i }).last()`
- `1794` — `const editor = page .locator('.ProseMirror[contenteditable="true"]') .first();`
- `1805` — `const editor = page .locator('.ProseMirror[contenteditable="true"]') .first();`
- `1914` — `const editor = page .locator('.ProseMirror[contenteditable="true"]') .first();`
- `2007` — `await page.getByTestId('manage-button').first().click();`
- `2050` — `const editor = page .locator('.ProseMirror[contenteditable="true"]') .first();`
- `2062` — `const editor = page .locator('.ProseMirror[contenteditable="true"]') .first();`

## e2e/Features/ContextCenterDashboard.spec.ts  (3)

- `238` — `const firstItem = mostCitedCard.getByTestId('most-cited-count').first();`
- `241` — `const firstItemRow = mostCitedCard.getByRole('button').first();`
- `411` — `await page .getByTestId('document-detail-card') .getByRole('button', { name: 'View All Documents' }) .first()`

## e2e/Features/ContextCenterDocument.spec.ts  (3)

- `221` — `const scrollableContainer = view .locator('[class*="overflow-y-auto"]') .first();`
- `396` — `const menu = page.getByRole('menu').last();`
- `443` — `const menu = page.getByRole('menu').last();`

## e2e/Features/ContextCenterMemories.spec.ts  (4)

- `719` — `await page .getByText(/total memor/i) .first()`
- `990` — `rows.first().getByText('Cited 999999 times')`
- `998` — `await expect(rows.first()).toContainText(/Last/);`
- `2087` — `const firstRowId = await firstPageRows .first()`

## e2e/Features/ContextCenterPermission.spec.ts  (3)

- `2162` — `const editor = dataConsumerPage .locator('[contenteditable="true"]') .first();`
- `2202` — `const editor = dataStewardPage .locator('[contenteditable="true"]') .first();`
- `2294` — `await expect(rows.first()).toContainText('aaa-sort-updatedby.');`

## e2e/Features/CustomizeDetailPage.spec.ts  (2)

- `534` — `const customTab = userPage .locator('main [role="tablist"]') .last()`
- `669` — `const customTab = userPage .locator('main [role="tablist"]') .last()`

## e2e/Features/CustomizeNavigationNewItems.spec.ts  (4)

- `177` — `adminPage .getByTestId('page-layout-v1') .getByText('Ontology Studio') .first()`
- `186` — `adminPage .getByTestId('page-layout-v1') .getByText('Metrics') .first()`
- `195` — `adminPage .getByTestId('page-layout-v1') .getByText('Glossary') .first()`
- `305` — `await adminPage .getByTestId('page-layout-v1') .getByText('Glossary') .first()`

## e2e/Features/DataAssetRulesDisabled.spec.ts  (3)

- `348` — `await page .locator('.rdg-cell[role="gridcell"]') .first()`
- `491` — `await page .locator('.rdg-cell[role="gridcell"]') .first()`
- `645` — `await page .locator('.rdg-cell[role="gridcell"]') .first()`

## e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts  (3)

- `55` — `await page .getByRole('option') .filter({ hasText: table.entityResponseData.fullyQualifiedName }) .first()`
- `126` — `await page .getByRole('option') .filter({ hasText: testType }) .first()`
- `422` — `await page.getByTestId('more-actions').first().click();`

## e2e/Features/DataQuality/ColumnLevelTests.spec.ts  (2)

- `136` — `const dimensionOption = page.getByRole('option').first();`
- `1551` — `const postalCodeOption = page .getByRole('option') .filter({ hasText: 'POSTAL_CODE' }) .first();`

## e2e/Features/DataQuality/DataQuality.spec.ts  (1)

- `1296` — `await page.getByTitle('All').nth(1).click();`

## e2e/Features/DataQuality/DataQualityDashboard.spec.ts  (1)

- `962` — `const dimensionCard = page .locator('[data-testid="status-data-widget"]') .filter({ hasText: dimension.displayText }) .first();`

## e2e/Features/DataQuality/Dimensionality.spec.ts  (1)

- `120` — `await page .getByRole('option') .filter({ hasText: NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.label }) .first()`

## e2e/Features/DataQuality/Profiler.spec.ts  (2)

- `298` — `await page .locator('.ant-select-dropdown') .locator( `[title="${profilerSetting.includeColumns}"]:not(.ant-select-dropdown-hidden)` ) .last()`
- `317` — `await page .locator('.ant-select-dropdown') .locator( `[title="${profilerSetting.partitionColumnName}"]:not(.ant-select-dropdown-hidden)` ) .last()`

## e2e/Features/DataQuality/TableLevelTests.spec.ts  (2)

- `674` — `await page .getByRole('option') .filter({ hasText: 'Compare 2 tables for differences' }) .first()`
- `701` — `const table2Option = page .getByRole('option') .filter({ hasText: table2.entityResponseData?.['fullyQualifiedName'] ?? '', }) .first();`

## e2e/Features/DataQuality/TestCaseResultPermissions.spec.ts  (1)

- `225` — `if (await resultChart.first().isVisible()) {`

## e2e/Features/DataQuality/TestLibrary.spec.ts  (3)

- `984` — `await page .getByTestId('supported-services') .locator('div') .filter({ hasText: 'Mysql' }) .getByRole('button') .first()`
- `1078` — `await page .getByTestId('supported-services') .locator('div') .filter({ hasText: 'Postgres' }) .getByRole('button') .first()`
- `1092` — `await page .getByTestId('supported-services') .locator('div') .filter({ hasText: 'BigQuery' }) .getByRole('button') .first()`

## e2e/Features/DomainFilterQueryFilter.spec.ts  (2)

- `849` — `await page.locator('.filters-row button').first().click();`
- `868` — `await page.locator('.filters-row button').first().click();`

## e2e/Features/EntitySummaryPanel.spec.ts  (4)

- `33` — `const firstEntityCard = page .locator('[data-testid="table-data-card"]') .first();`
- `51` — `const entityLink = summaryPanel .locator('[data-testid="entity-link"]') .first();`
- `109` — `const entityLink = summaryPanel .locator('[data-testid="entity-link"]') .first();`
- `215` — `const entityLink = summaryPanel.getByTestId('entity-link').first();`

## e2e/Features/FailedTestCaseSampleData.spec.ts  (1)

- `117` — `const sampleDataTable = page.getByTestId('sample-data-table').first();`

## e2e/Features/Glossary/GlossaryAdvancedOperations.spec.ts  (1)

- `812` — `await page.getByTestId('delete-ref-btn').nth(1).click();`

## e2e/Features/Glossary/GlossaryAssets.spec.ts  (6)

- `153` — `const assetLink = page .getByTestId('table-data-card') .getByTestId('entity-link') .first();`
- `274` — `const assetCard = page .locator(`[data-testid*="${topicEntity.entityResponseData?.name}"]`) .first();`
- `368` — `await checkboxes.nth(0).check();`
- `369` — `await checkboxes.nth(1).check();`
- `421` — `const addOption = page.locator('.ant-dropdown-menu-item').first();`
- `442` — `const assetCheckbox = page .getByTestId('asset-selection-modal') .locator(`text=${topicEntity.entity.name}`) .first();`

## e2e/Features/Glossary/GlossaryMiscOperations.spec.ts  (1)

- `163` — `await page.getByTestId('rename-button').first().click();`

## e2e/Features/Glossary/GlossaryP3Tests.spec.ts  (5)

- `248` — `await voteSection .first()`
- `581` — `const expandIcon = page .locator('[data-testid="expand-icon"]') .first();`
- `589` — `await page .locator('tr[data-row-key]') .first()`
- `706` — `(await badMessage .first()`
- `710` — `(await errorState .first()`

## e2e/Features/Glossary/GlossaryStatusFilterLargeDataset.spec.ts  (2)

- `373` — `const firstRow = rows.first();`
- `545` — `await page .locator('tbody > tr:not([aria-hidden="true"])') .first()`

## e2e/Features/Glossary/GlossaryStatusFilterNestedTerms.spec.ts  (3)

- `170` — `const termRow = page.locator(`[data-row-key*="${termName}"]`).first();`
- `230` — `await page .locator('tbody > tr:not([aria-hidden="true"])') .first()`
- `245` — `await page .locator('tbody > tr:not([aria-hidden="true"])') .first()`

## e2e/Features/Glossary/GlossaryTermDetails.spec.ts  (1)

- `134` — `await page .getByTestId('glossary-term-references-modal') .getByTestId('delete-ref-btn') .first()`

## e2e/Features/Glossary/GlossaryWorkflow.spec.ts  (1)

- `510` — `const statusIndicator = termRow .locator('[data-testid="status"], .status-badge, .ant-tag') .first();`

## e2e/Features/Glossary/LargeGlossaryPerformance.spec.ts  (5)

- `304` — `const term5Row = page.locator('tr', { hasText: 'Term_1' }).first();`
- `346` — `const statusDropdown = page.getByText('Status').first();`
- `353` — `const approvedCheckbox = page.locator('text=Approved').first();`
- `354` — `const draftCheckbox = page.locator('text=Draft').first();`
- `446` — `const term5Row = page.locator('tr', { hasText: 'Term_1' }).first();`

## e2e/Features/ImpactAnalysis.spec.ts  (6)

- `829` — `const firstAssetLink = lineageCardTable .locator('tbody tr') .first()`
- `829` — `const firstAssetLink = lineageCardTable .locator('tbody tr') .first() .locator('td') .first()`
- `1059` — `const firstDepthCell = nodeDepthCells.first();`
- `1083` — `await glossaryOptions.first().click();`
- `1115` — `const firstRow = page.locator('tbody tr').first();`
- `1118` — `const nameCell = firstRow.locator('td').first();`

## e2e/Features/IncidentManager.spec.ts  (10)

- `183` — `? page .locator('[data-testid="test-case-incident-manager-table"] tbody tr') .filter({ hasText: testCaseName }) .locator('button') .last()`
- `342` — `const resolveMenuItem = page .locator( '[data-testid="task-action-menu-item-resolve"]:visible, [data-testid="workflow-transition-menu-item-resolve"]:v`
- `347` — `const startProgressMenuItem = page .locator( '[data-testid="task-action-menu-item-startProgress"]:visible, [data-testid="workflow-transition-menu-item`
- `352` — `const workflowMenuItem = page .locator( '[data-testid="task-action-menu-item-resolve"]:visible, [data-testid="workflow-transition-menu-item-resolve"]:`
- `744` — `const resolveReasonSelect = resolveModal .locator('.ant-select-selector') .first();`
- `753` — `await resolveTextareas.first().fill('test');`
- `755` — `await resolveTextareas.nth(0).fill('Missing Data');`
- `756` — `await resolveTextareas.nth(1).fill('test');`
- `758` — `await resolveTextareas.first().fill('test');`
- `824` — `await page .locator('[data-testid="resolved-comment-textarea"] textarea') .first()`

## e2e/Features/IngestionListNameSorting.spec.ts  (2)

- `185` — `const nameHeader = page.locator('th:has-text("Name")').first();`
- `221` — `await page.locator('th:has-text("Name")').first().click();`

## e2e/Features/LineageExportPNGSnapshot.spec.ts  (1)

- `56` — `await page .locator('.react-flow__node') .first()`

## e2e/Features/MetricBulkImportExportEdit.spec.ts  (8)

- `573` — `const row = page.locator('tr').filter({ hasText: fixtures.prefix }).first();`
- `627` — `const displayNameCell = page .locator('.rdg-row') .first()`
- `633` — `const editor = page.locator(`${RDG_ACTIVE_CELL_SELECTOR} input`).first();`
- `646` — `const editor = page.locator(`${RDG_ACTIVE_CELL_SELECTOR} input`).first();`
- `1617` — `const newRow = page.locator('.rdg-row').last();`
- `1621` — `const nameEditor = page .locator(`${RDG_ACTIVE_CELL_SELECTOR} input`) .first();`
- `1848` — `const row = page .locator('tr') .filter({ hasText: fixtures.prefix }) .first();`
- `1868` — `const row = page .locator('tr') .filter({ hasText: fixtures.prefix }) .first();`

## e2e/Features/OnlineUsers.spec.ts  (1)

- `125` — `const userCell = getCellByName(page, displayName).first();`

## e2e/Features/Pagination.spec.ts  (5)

- `893` — `await page.locator('table').first().waitFor({ state: 'visible' });`
- `915` — `await page.locator('table').first().waitFor({ state: 'visible' });`
- `939` — `await page.locator('table').first().waitFor({ state: 'visible' });`
- `956` — `await page.locator('table').first().waitFor({ state: 'visible' });`
- `984` — `await page.locator('table').first().waitFor({ state: 'visible' });`

## e2e/Features/Permissions/DataProductPermissions.spec.ts  (4)

- `116` — `element = testUserPage.getByTestId(testId).first();`
- `122` — `const ownerButton = testUserPage .getByTestId('add-owner') .or(testUserPage.getByTestId('edit-owner')) .first();`
- `170` — `element = testUserPage.getByTestId(testId).first();`
- `176` — `const ownerButton = testUserPage .getByTestId('add-owner') .or(testUserPage.getByTestId('edit-owner')) .first();`

## e2e/Features/Permissions/DomainPermissions.spec.ts  (4)

- `112` — `element = testUserPage.getByTestId(testId).first();`
- `122` — `const ownerButton = testUserPage .getByTestId('add-owner') .or(testUserPage.getByTestId('edit-owner')) .first();`
- `182` — `element = testUserPage.getByTestId(testId).first();`
- `189` — `const ownerButton = testUserPage .getByTestId('add-owner') .or(testUserPage.getByTestId('edit-owner')) .first();`

## e2e/Features/Permissions/GlossaryPermissions.spec.ts  (2)

- `113` — `element = testUserPage.getByTestId(testId).first();`
- `174` — `element = testUserPage.getByTestId(testId).first();`

## e2e/Features/PersonaAIContext.spec.ts  (12)

- `573` — `await adminPage.getByTestId('delete-condition-button').last().click();`
- `1262` — `await adminPage.getByTestId('delete-condition-button').last().click();`
- `1318` — `const fieldContainer = comboboxField( adminPage, 'advanced-search-field-select' ).first();`
- `1393` — `const serviceField = comboboxField( adminPage, 'advanced-search-field-select' ).first();`
- `1401` — `const operatorLocator = comboboxField( adminPage, 'advanced-search-operator-select' ).first();`
- `1408` — `const valueSelect = comboboxField( adminPage, 'advanced-search-value' ).first();`
- `1693` — `const firstField = comboboxField( adminPage, 'advanced-search-field-select' ).first();`
- `1700` — `const firstOp = comboboxField( adminPage, 'advanced-search-operator-select' ).first();`
- `1706` — `const alphaInput = drawer .locator( '[data-testid=advanced-search-value] input[type="text"]:not([role="combobox"])' ) .first();`
- `1731` — `const secondField = comboboxField( adminPage, 'advanced-search-field-select' ).last();`
- `1737` — `const secondOp = comboboxField( adminPage, 'advanced-search-operator-select' ).last();`
- `1743` — `const betaInput = drawer .locator( '[data-testid=advanced-search-value] input[type="text"]:not([role="combobox"])' ) .last();`

## e2e/Features/PersonaAIContextRules.spec.ts  (5)

- `87` — `await emptyBtn.or(headerBtn).first().waitFor({ state: 'visible' });`
- `294` — `comboboxField(page, 'advanced-search-field-select').first(),`
- `303` — `const operatorLocator = comboboxField( page, 'advanced-search-operator-select' ).first();`
- `312` — `const textInput = page .locator( '[data-testid=advanced-search-value] input[type="text"]:not([role="combobox"])' ) .first();`
- `367` — `page .getByRole('listbox') .getByRole('option', { name: /metric/i }) .first()`

## e2e/Features/RTL.spec.ts  (1)

- `71` — `page .getByTestId('explore-tree') .getByRole('row') .filter({ hasText: serviceType }) .first()`

## e2e/Features/RestoreEntityInheritedFields.spec.ts  (1)

- `377` — `await page.getByTestId('breadcrumb').getByRole('link').first().click();`

## e2e/Features/SampleDataTableOperations.spec.ts  (2)

- `83` — `page.getByTestId('sample-data-table').getByRole('row').nth(1)`
- `343` — `page.getByTestId('sample-data-table').getByRole('row').nth(1)`

## e2e/Features/SearchExport.spec.ts  (2)

- `269` — `const firstTabCountText = await page .getByTestId('explore-left-panel') .getByRole('tab') .first()`
- `348` — `const filteredCountText = await page .getByTestId('explore-left-panel') .getByRole('tab') .first()`

## e2e/Features/ServiceAgentsDeploymentSummary.spec.ts  (7)

- `323` — `await expect(dots.nth(2)).not.toHaveClass(/opacity-\[0\.55\]/);`
- `324` — `await expect(dots.nth(0)).toHaveClass(/opacity-\[0\.55\]/);`
- `341` — `await expect(items.nth(0)).toContainText('Partial Success');`
- `342` — `await expect(items.nth(1)).toContainText('Success');`
- `343` — `await expect(items.nth(2)).toContainText('Failed');`
- `346` — `await expect(items.nth(2)).toHaveClass(/border-utility-brand-600/);`
- `347` — `await expect(items.nth(0)).not.toHaveClass(/border-utility-brand-600/);`

## e2e/Features/SettingsNavigationPage.spec.ts  (2)

- `207` — `const domainSwitch = page .locator('.ant-tree-title:has-text("Domains")') .first()`
- `284` — `await expect(treeItems.first()).not.toHaveText(firstItemText as string);`

## e2e/Features/StorageMetadataAgentForm.spec.ts  (1)

- `56` — `await page.getByTestId('more-actions').first().click();`

## e2e/Features/Tasks/ActivityFeed.spec.ts  (2)

- `133` — `await expect(taskItems.first()).toContainText(/TASK-/);`
- `144` — `const taskItem = feedWidget .locator('[data-testid="task-feed-card"]') .first();`

## e2e/Features/Tasks/TaskComments.spec.ts  (1)

- `326` — `await mentionItem.first().click();`

## e2e/Features/Tasks/TaskCreation.spec.ts  (3)

- `129` — `const columnRow = page .locator('tr') .filter({ has: page.locator('[data-testid="column-name"]') }) .first();`
- `365` — `const taskCard = page.locator('[data-testid="task-feed-card"]').first();`
- `435` — `const tagOption = page.getByTestId('tag-PII.Sensitive').first();`

## e2e/Features/Tasks/TaskCustomFormWorkflow.spec.ts  (5)

- `453` — `await editAcceptDropdown.locator('button').last().click();`
- `456` — `const workflowActionButton = page .locator( '[data-testid="workflow-task-action-primary"], [data-testid="workflow-task-action-dropdown"]' ) .first();`
- `465` — `const visibleModal = page.getByRole('dialog').first();`
- `467` — `const proposedTextField = visibleModal .locator('.ant-form-item') .filter({ hasText: 'Proposed Text' }) .getByRole('textbox') .first();`
- `472` — `const reviewNotesField = visibleModal .locator('.ant-form-item') .filter({ hasText: 'Review Notes' }) .getByRole('textbox') .first();`

## e2e/Features/Tasks/TaskNavigation.spec.ts  (6)

- `95` — `const taskItem = feedWidget .locator( '[data-testid="task-feed-card"], [data-testid="message-container"]' ) .first();`
- `147` — `const taskCard = page.locator('[data-testid="task-feed-card"]').first();`
- `272` — `const taskCard = page.locator('[data-testid="task-feed-card"]').first();`
- `428` — `const taskLink = notificationBox .locator('[data-testid^="notification-link-"]') .first();`
- `651` — `const latestNotification = notificationBox .locator('li.ant-list-item.notification-dropdown-list-btn') .first();`
- `753` — `const latestNotification = notificationBox .locator('li.ant-list-item.notification-dropdown-list-btn') .first();`

## e2e/Features/TestSuiteMultiPipeline.spec.ts  (3)

- `80` — `await page .getByRole('option') .filter({ hasText: 'Table Column Count To Equal' }) .first()`
- `149` — `await expect(defaultPipelineTestCaseCount.first()).toContainText('All');`
- `209` — `await page .getByTestId('ingestion-list-table') .getByTestId('more-actions') .first()`

## e2e/Features/Topic.spec.ts  (3)

- `83` — `const copyButton = page.getByTestId('copy-field-link-button').first();`
- `128` — `await expandButtons.first().click();`
- `136` — `const nestedCopyButton = nestedCopyButtons.nth(1);`

## e2e/Features/Workflows/NoOpWorkflowNodeConfig.spec.ts  (1)

- `107` — `const node = page .locator('.react-flow__node') .filter({ hasText: 'Run App' }) .first();`

## e2e/Features/Workflows/WorkflowOssRestrictions.spec.ts  (1)

- `72` — `const taskNode = page .locator('.react-flow__node') .filter({ hasNotText: /^Start$/ }) .filter({ hasNotText: /^End$/ }) .filter({ hasNotText: /^Approv`

## e2e/Flow/ConnectionConfigLayout.spec.ts  (4)

- `265` — `const formBody = panel.locator('> div').first();`
- `414` — `const sampleBody = samplePanel .locator('.core-object-field-template-body-grid') .first();`
- `471` — `const storageBody = storagePanel .locator('.core-object-field-template-credential-field-grid') .first();`
- `640` — `await tableSection.getByRole('button', { name: 'Add' }).first().click();`

## e2e/Flow/IngestionBot.spec.ts  (1)

- `165` — `ingestionBotPage.getByTestId('domain-link').first()`

## e2e/Flow/ObservabilityAlerts.spec.ts  (1)

- `509` — `const searchFailureAlert = page .getByTestId('alert-bar') .filter({ hasText: 'Search failed' }) .first();`

## e2e/Flow/SchemaTable.spec.ts  (3)

- `185` — `const copyButton = page.getByTestId('copy-column-link-button').first();`
- `252` — `await expandButtons.first().click();`
- `258` — `const nestedCopyButton = nestedCopyButtons.nth(1);`

## e2e/Flow/ServiceDocPanel.spec.ts  (6)

- `76` — `const admonition = docPanel.locator('.admonition-note').first();`
- `102` — `const externalLink = docPanel.locator('a[target="_blank"]').first();`
- `118` — `const image = docPanel.locator('img').first();`
- `240` — `await page .locator( '[data-testid="select-widget-root/credentials/gcpConfig__oneof_select"] button' ) .first()`
- `345` — `const codeBlock = docPanel.locator('pre').first();`
- `346` — `const copyButton = docPanel.getByTestId('code-block-copy-icon').first();`

## e2e/PageObject/Explore/DataQualityPageObject.ts  (14)

- `64` — `this.nameLink = this.testCaseCards .locator('.test-case-name, [class*="name"], a') .first();`
- `72` — `this.noDataPlaceholder = this.container .locator( '[data-testid="no-data-placeholder"], .no-data-placeholder, .ant-empty' ) .first();`
- `158` — `const testCaseLink = this.container .locator(`.test-case-name[data-testid="test-case-${testCaseName}"]`) .first();`
- `254` — `const card = cards.filter({ hasText: testCaseName }).first();`
- `271` — `const card = this.testCaseCards.filter({ hasText: testCaseName }).first();`
- `302` — `const incidentCard = this.incidentsTabContent .locator('.test-case-card') .first();`
- `358` — `const card = cards.nth(cardIndex);`
- `360` — `const nameElement = this.nameLink.nth(cardIndex);`
- `374` — `const card = this.testCaseCards.nth(cardIndex);`
- `388` — `const statusBadge = this.testCaseStatusBadge.nth(cardIndex);`
- `407` — `const card = cards.nth(cardIndex);`
- `423` — `const card = cards.nth(cardIndex);`
- `425` — `await this.nameLink.nth(cardIndex).waitFor({ state: 'visible' });`
- `426` — `await expect(this.nameLink.nth(cardIndex)).toHaveAttribute('href', /.+/);`

## e2e/PageObject/Explore/OverviewPageObject.ts  (1)

- `144` — `this.selectOwnerTabsRoleTab = this.page .locator('[data-testid="select-owner-tabs"] [role="tab"]') .first();`

## e2e/PageObject/Explore/RightPanelPageObject.ts  (1)

- `775` — `return this.getSummaryPanel() .getByRole('tab') .filter({ hasText: pattern }) .first();`

## e2e/PageObject/Explore/SchemaPageObject.ts  (1)

- `41` — `this.expandIcon = this.schemaFieldsContainer .getByTestId('expand-icon') .first();`

## e2e/Pages/AppRunsHistoryLogs.spec.ts  (1)

- `95` — `await page.getByTestId('logs').first().click();`

## e2e/Pages/AuditLogs.spec.ts  (1)

- `492` — `const option50Global = page .locator( '.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item' ) .filter({ hasText: '50' }) .first();`

## e2e/Pages/DataContractInheritance.spec.ts  (1)

- `81` — `const firstOwner = page.getByTestId('owner-option').first();`

## e2e/Pages/DataContracts.spec.ts  (3)

- `428` — `const testTypeOption = page .getByRole('option') .filter({ hasText: NEW_TABLE_TEST_CASE.label }) .first();`
- `659` — `await page.getByTestId('delete-condition-button').last().click();`
- `2408` — `await page .locator('.rc-virtual-list-holder-inner li') .first()`

## e2e/Pages/DataContractsSemanticRules.spec.ts  (7)

- `1567` — `const versionInput = page .getByTestId('query-builder-group-card') .first()`
- `1689` — `const versionInput = page .getByTestId('query-builder-group-card') .first()`
- `1787` — `const versionInput = page .getByTestId('query-builder-group-card') .first()`
- `1869` — `const versionInput = page .getByTestId('query-builder-group-card') .first()`
- `1952` — `const versionInput = page .getByTestId('query-builder-group-card') .first()`
- `2036` — `const versionInput = page .getByTestId('query-builder-group-card') .first()`
- `3761` — `await deleteButtons.first().click();`

## e2e/Pages/DataMarketplaceAnnouncements.spec.ts  (1)

- `85` — `await page .getByTestId(/^announcement-item-/) .first()`

## e2e/Pages/DataProductAndSubdomains.spec.ts  (3)

- `166` — `const descriptionEditor = page .locator('[contenteditable="true"]') .first();`
- `205` — `const editor = page.locator('[contenteditable="true"]').first();`
- `402` — `const assetCard = assetModal .locator(`[data-testid*="${assetName}"]`) .or(assetModal.getByText(assetName)) .first();`

## e2e/Pages/DataProducts.spec.ts  (1)

- `521` — `await page .locator('[role="listbox"]') .first()`

## e2e/Pages/DomainAdvanced.spec.ts  (2)

- `174` — `page.locator('[data-testid="domain-link"]').first()`
- `196` — `page.locator('[data-testid="domain-link"]').first()`

## e2e/Pages/DomainUIInteractions.spec.ts  (4)

- `342` — `await page.getByTestId('rename-button').first().click();`
- `569` — `await page.getByTestId('rename-button').first().click();`
- `816` — `const domainLink = page.locator('[data-testid="domain-link"]').first();`
- `915` — `const copyButton = page .locator('[data-testid="entity-header-name"] button') .first();`

## e2e/Pages/Domains.spec.ts  (3)

- `3207` — `page .getByRole('row', { name: domainDisplayName, }) .locator('div') .nth(2)`
- `3215` — `await page .getByRole('row', { name: domainDisplayName }) .locator('div') .nth(2)`
- `3222` — `page .getByRole('row', { name: subDomain.data.displayName }) .locator('div') .nth(2)`

## e2e/Pages/Entity.spec.ts  (12)

- `813` — `const nextButton = panelContainer .locator('.navigation-container') .locator('button') .nth(1);`
- `835` — `const prevButton = panelContainer .locator('.navigation-container') .locator('button') .nth(0);`
- `940` — `const countBadge = panelContainer .locator('text=/^\\d+$/') .filter({ hasNot: page.locator('.nested-column-name') }) .first();`
- `998` — `const firstLink = nestedColumnLinks.first();`
- `1029` — `const prevButton = panelContainer .locator('.navigation-container') .locator('button') .nth(0);`
- `1052` — `const intermediateLink = allNestedLinks.nth(middleIndex);`
- `1549` — `await expect(dataTypeChip.first()).toBeAttached();`
- `1617` — `const nextButton = page .locator('.navigation-container') .locator('button') .nth(1);`
- `1641` — `const prevButton = page .locator('.navigation-container') .locator('button') .nth(0);`
- `1677` — `const columnName = page .locator(`[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`) .getByTestId(columnNameTestId) .first();`
- `1910` — `successCards.first().locator('.test-case-name')`
- `2033` — `const assigneeSection = incidentCards .first()`

## e2e/Pages/ExplorePageRightPanel.spec.ts  (6)

- `503` — `await fieldCards .first()`
- `511` — `const firstCardId = await fieldCards .nth(0)`
- `514` — `const secondCardId = await fieldCards .nth(1)`
- `714` — `const downstreamCard = lineageContainer .locator('.lineage-item-card') .first();`
- `725` — `const upstreamCard = lineageContainer .locator('.lineage-item-card') .first();`
- `910` — `const testCaseLink = tabContent .locator(`[data-testid="test-case-${failedCase.name}"]`) .first();`

## e2e/Pages/ExploreTree.spec.ts  (4)

- `119` — `await page .locator('div') .filter({ hasText: /^Governance$/ }) .locator('svg') .first()`
- `238` — `const classificationBreadcrumb = page .getByTestId('search-container') .locator('a[href*="/tags/"]') .first();`
- `589` — `const copyButton = page.getByTestId('copy-field-link-button').first();`
- `631` — `const copyButton = page.getByTestId('copy-field-link-button').first();`

## e2e/Pages/Glossary.spec.ts  (6)

- `186` — `const firstNotification = page1 .locator('.ant-list-items > .ant-list-item') .first();`
- `1219` — `await page.getByTestId('approve-button').first().click();`
- `1262` — `await page.getByTestId('approve-button').first().click();`
- `1707` — `await page.locator('thead th').first().waitFor({ state: 'visible' });`
- `2163` — `const languageDropdown = page .locator('.nav-bar-side-items button.ant-dropdown-trigger') .filter({ hasText: 'EN' }) .first();`
- `2206` — `const languageDropdown = page .locator('.nav-bar-side-items button.ant-dropdown-trigger') .filter({ hasText: 'DE' }) .first();`

## e2e/Pages/GlossaryImportExport.spec.ts  (3)

- `216` — `const lastRow = page.locator('.rdg-row').last();`
- `217` — `const firstCell = lastRow.locator('.rdg-cell').first();`
- `902` — `const errorCell = page .locator('.rdg-row') .first()`

## e2e/Pages/GlossaryTermRelationSettings.spec.ts  (3)

- `156` — `const nextBtn = page.getByRole('button', { name: 'Next Page' }).first();`
- `169` — `await page .locator('[data-testid="relation-types-table"] tbody tr') .first()`
- `342` — `await page.getByRole('button', { name: 'Next Page' }).first().click();`

## e2e/Pages/IntakeForm.spec.ts  (12)

- `185` — `page .locator( `[data-testid="${testId}"] input, input[data-testid="${testId}"], textarea[data-testid="${testId}"]` ) .first();`
- `218` — `const input = page .locator( `[data-testid="${testId}"] input[role="combobox"], [data-testid="${testId}"][role="combobox"]` ) .first();`
- `241` — `: page.getByRole('option').filter({ hasText: optionText }).first();`
- `626` — `const typeFieldGroup = page .locator('div') .filter({ has: typeSelect }) .filter({ has: page.getByTestId('form-item-label') }) .last();`
- `641` — `await page .locator('.om-block-editor[contenteditable="true"]') .first()`
- `1067` — `await page .locator('.om-block-editor[contenteditable="true"]') .first()`
- `1074` — `const stewardInput = page .getByRole('combobox', { name: 'Steward' }) .or(page.getByRole('textbox', { name: 'Steward' })) .first();`
- `1090` — `await adminOption.first().click();`
- `1348` — `await page .locator(descriptionBox) .first()`
- `1405` — `await dateTimeField.getByRole('button').first().click();`
- `1411` — `await dateTimeField.getByRole('spinbutton').first().click();`
- `1418` — `await timeField.getByRole('spinbutton').first().click();`

## e2e/Pages/LogsViewer.spec.ts  (1)

- `110` — `await page.getByTestId('logs-button').first().click();`

## e2e/Pages/ODCSImportExport.spec.ts  (3)

- `1916` — `const descriptionSection = page.locator('.contract-card-items').first();`
- `1920` — `const markdownParser = page.getByTestId('markdown-parser').first();`
- `2101` — `const descriptionSection = page.getByTestId('markdown-parser').first();`

## e2e/Pages/Policies.spec.ts  (11)

- `61` — `await page .locator(descriptionBox) .nth(descriptionIndex)`
- `70` — `await page.locator('.ant-select-tree-checkbox-inner').first().click();`
- `76` — `await page.locator('.ant-select-tree-checkbox-inner').nth(1).click();`
- `150` — `await getDescriptionBox(page).nth(0).fill(DESCRIPTION);`
- `164` — `page .locator( '[data-testid="asset-description-container"] [data-testid="viewer-container"]' ) .nth(0)`
- `173` — `page .locator( '[data-testid="viewer-container"] > [data-testid="markdown-parser"]' ) .nth(1)`
- `211` — `page .locator( '[data-testid="asset-description-container"] [data-testid="viewer-container"]' ) .nth(0)`
- `245` — `page.locator('[data-testid="resources"]').last()`
- `249` — `page.locator('[data-testid="operations"]').last()`
- `253` — `page.locator('[data-testid="effect"]').last()`
- `257` — `page.locator('[data-testid="condition"]').last()`

## e2e/Pages/ProfilerConfigurationPage.spec.ts  (2)

- `60` — `await page .locator('[data-testid^="remove-filter-"]') .first()`
- `66` — `await rows.first().click();`

## e2e/Pages/Roles.spec.ts  (2)

- `543` — `const roleLocator = page .getByTestId('role-name') .filter({ hasText: role.data.displayName }) .first();`
- `563` — `const deleteButton = page .locator( '[data-testid="delete-button"], [data-testid="delete-button-title"]' ) .first();`

## e2e/Pages/SearchSettings.spec.ts  (2)

- `250` — `const firstFieldContainer = fieldContainers.first();`
- `796` — `const firstFieldContainer = fieldContainers.first();`

## e2e/Pages/Tag.spec.ts  (1)

- `373` — `const classificationEntry = adminPage .locator('[data-testid="side-panel-classification"]') .getByText(classification1.responseData.displayName, { exa`

## e2e/Pages/Tags.spec.ts  (3)

- `417` — `const acceptButton = page.getByTestId('approve-button').first();`
- `549` — `const displayNameTrigger = page .getByTestId('KnowledgePanel.Tags') .getByTestId('tags-container') .getByTestId('add-tag') .first();`
- `783` — `tagsPanel.getByTestId('edit-button').first()`

## e2e/Pages/TaskFormSettings.spec.ts  (1)

- `39` — `await page .locator('.ant-select-dropdown .ant-select-item-option-content') .filter({ hasText: option }) .first()`

## e2e/Pages/TestSuiteDetailsPage.spec.ts  (1)

- `199` — `const firstTestCaseCheckbox = dialog .locator('[data-testid^="checkbox-"]') .first();`

## e2e/Pages/UserDetails.spec.ts  (3)

- `107` — `const teamOption = adminPage .locator('[title="' + team.responseData.displayName + '"]') .first();`
- `160` — `await adminPage.getByText(team.responseData.displayName).first().click();`
- `603` — `const assetCard = adminPage.getByText(assetCardText).first();`

## e2e/Pages/Users.spec.ts  (16)

- `649` — `await page .getByTestId('message-container') .first()`
- `654` — `const avatar = page .locator('#feedData [data-testid="message-container"]') .first()`
- `654` — `const avatar = page .locator('#feedData [data-testid="message-container"]') .first() .locator('[data-testid="profile-avatar"]') .first();`
- `840` — `const secondPersona = personaLabels.nth(1);`
- `886` — `const firstPersona = personaLabels.first();`
- `923` — `personaLabels.first().locator('[data-testid="default-persona-tag"]')`
- `926` — `personaLabels.first().locator('input[type="radio"]')`
- `930` — `const originalDefaultPersonaText = await personaLabels .first()`
- `981` — `const newDefaultPersonaLocator = updatedPersonaLabels .first()`
- `993` — `updatedPersonaLabels .first()`
- `998` — `updatedPersonaLabels.first().locator('input[type="radio"]')`
- `1119` — `const personaChip = personaCard .locator('[data-testid="chip-container"] [data-testid="tag-chip"]') .first();`
- `1122` — `const personaLink = personaChip.locator('a').first();`
- `1143` — `await adminPage .locator('[data-testid="edit-user-persona"]') .first()`
- `1233` — `const defaultPersonaChip = adminPage .locator('.default-persona-text [data-testid="tag-chip"]') .first();`
- `1236` — `const personaLink = defaultPersonaChip.locator('a').first();`

## e2e/Search/SearchRelevance.spec.ts  (2)

- `601` — `signalBoosts.getByTestId('ranking-signal-contributor').first()`
- `662` — `await expect(page.getByTestId('ranking-details').first()).toContainText(`

## e2e/VersionPages/EntityVersionPages.spec.ts  (1)

- `403` — `const latestVersionEntry = page .locator('[data-testid^="version-entry-"]') .first();`

## e2e/nightly/ContextCenter.spec.ts  (1)

- `209` — `await page.getByRole('paragraph').last().click();`

## e2e/nightly/ServiceIngestion.spec.ts  (2)

- `377` — `await runDots.first().click();`
- `668` — `await page.getByTestId('more-actions').first().click();`

## support/entity/ingestion/ServiceBaseClass.ts  (5)

- `249` — `await page.getByTestId('run-agent-button').first().click();`
- `388` — `await page.getByTestId('more-actions').first().click();`
- `544` — `await page.getByTestId('logs-button').first().waitFor({ state: 'visible' });`
- `555` — `await page.getByTestId('run-agent-button').first().click();`
- `570` — `await expect(page.getByTestId('markdown-parser').first()).toHaveText(`

## support/team/TeamClass.ts  (1)

- `93` — `const teamLink = page .getByRole('link', { name: expectedDisplayName }) .first();`

## support/user/UserClass.ts  (2)

- `327` — `const modal = await page .getByRole('dialog') .locator('div') .filter({ hasText: 'Getting Started' }) .nth(1)`
- `335` — `await page.getByRole('dialog').getByRole('img').first().click();`

## utils/ContextCenterUtil.ts  (7)

- `843` — `hierarchy .locator('[data-testid^="page-node-"]') .last()`
- `956` — `listing .locator('[data-testid^="knowledge-card-"]') .last()`
- `1255` — `await page.getByTestId('add-image-container').last().click();`
- `1277` — `await page.getByTestId('add-image-container').last().click();`
- `1301` — `await page.getByTestId('add-image-container').last().click();`
- `1325` — `await page.getByTestId('add-image-container').last().click();`
- `1349` — `await page.getByTestId('add-image-container').last().click();`

## utils/KnowledgeCenter.ts  (8)

- `38` — `await page.getByTestId('manage-button').first().click();`
- `110` — `const tagsContainer = page.locator('[data-testid="tags-container"]').first();`
- `410` — `await page.locator(`[data-value="@${userName}"]`).first().click();`
- `467` — `await expect(cards.nth(index)).toBeAttached();`
- `468` — `const card = cards.nth(index);`
- `544` — `return page.locator('.ProseMirror[contenteditable="true"]').first();`
- `888` — `const targetRow = rows.nth(row);`
- `890` — `const targetCell = cells.nth(col);`

## utils/activityFeed.ts  (4)

- `34` — `page.locator('[data-testid="message-container"]').nth(indexZeroBased);`
- `67` — `taskDescriptionTabs .getByRole('tabpanel') .getByTestId('markdown-parser') .first()`
- `193` — `const userSuggestionOption = page.locator(`[data-value="@${user}"]`).first();`
- `292` — `feedContainer.first().waitFor({ state: 'visible', timeout }),`

## utils/advancedSearch.ts  (5)

- `220` — `const control = comboboxInput.or(triggerButton).first();`
- `245` — `: listbox.getByRole('option', { name: optionTitle, exact: true }).first();`
- `404` — `const exactMatch = dropdown .getByRole('option', { name: new RegExp(`^${escapeRegex(searchData)}$`, 'i'), }) .first();`
- `413` — `await dropdown .getByRole('option') .filter({ hasText: new RegExp(escapeRegex(searchData), 'i') }) .first()`
- `694` — `await page.getByTestId('advanced-search-add-group').first().click();`

## utils/bot.ts  (1)

- `176` — `await page.locator('[data-testid="breadcrumb-link"]').first().click();`

## utils/common.ts  (6)

- `1092` — `const closeIcon = page.getByTestId('alert-icon-close').first();`
- `1266` — `const firstRow = page.locator('tbody tr').first();`
- `1267` — `await expect(firstRow.locator('td').nth(0)).not.toHaveText(`
- `1270` — `await expect(firstRow.locator('td').nth(1)).not.toHaveText(`
- `1672` — `const header = page.locator(`th:has-text("${columnHeader}")`).first();`
- `1676` — `const firstCell = page.locator(`${visibleRowSelector} td`).nth(columnIndex);`

## utils/customProperty.ts  (1)

- `456` — `container.locator(descriptionBoxReadOnly).last()`

## utils/customPropertyAdvancedSearchUtils.ts  (3)

- `497` — `await page .locator('[role="listbox"]:visible [role="option"]') .filter({ hasText: value as string }) .first()`
- `551` — `const startInput = ruleLocator .getByTestId('advanced-search-value') .locator('input') .first();`
- `555` — `const endInput = ruleLocator .getByTestId('advanced-search-value') .locator('input') .last();`

## utils/customizeLandingPage.ts  (4)

- `49` — `page .locator( `[data-testid="deferred-widget-${widgetKey}"], [data-testid^="deferred-widget-${widgetKey}-"]` ) .first();`
- `655` — `const firstEntity = entityItems.first();`
- `662` — `const entityLink = firstEntity.locator('.item-link').first();`
- `758` — `const card = widget.locator(cardSelector).first();`

## utils/customizeNavigation.ts  (1)

- `74` — `const childElement = page .locator(`[data-testid="app-bar-item-${items[1]}"]`) .first();`

## utils/dataContracts.ts  (1)

- `256` — `await suiteNameCell.locator('a').first().click();`

## utils/dataQuality.ts  (5)

- `44` — `await page.getByRole('option').filter({ hasText: label }).first().click();`
- `125` — `const slice = chart.locator('svg path').nth(segmentIndex + 1);`
- `334` — `const trigger = rowActionDropdown.first();`
- `586` — `const dropdownInput = modal.getByRole('combobox').first();`
- `633` — `const testCaseRows = page .getByTestId('test-case-table') .locator('[role="rowgroup"]') .last()`

## utils/domain.ts  (1)

- `1940` — `await page .getByTestId('ports-lineage-view') .or(page.locator('.ports-lineage-view-empty')) .first()`

## utils/entity.ts  (15)

- `143` — `const hasSearchBox = await page .getByTestId('searchBox') .first()`
- `869` — `const editButton = page .locator(`[${rowSelector}="${rowId}"]`) .getByTestId('description') .first()`
- `967` — `const tagButton = page .getByTestId(parentId) .getByTestId('tags-container') .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button') .first();`
- `985` — `await page .getByTestId(`tree-node-${tagFqn ? `${tagFqn}` : tag}`) .first()`
- `1137` — `const trigger = page .locator(`[${rowSelector}="${rowId}"]`) .getByTestId('tags-container') .getByTestId('edit-button') .first();`
- `1240` — `clickTarget = page .locator(`[${rowSelector}="${columnId}"]`) .getByTestId(columnNameTestId) .first();`
- `1246` — `const row = page.locator(`[${rowSelector}="${columnId}"]`).first();`
- `1328` — `glossaryWidgetTrigger(rowLocator, action).first(),`
- `1386` — `rowLocator .getByTestId('glossary-container') .getByTestId('edit-button') .first()`
- `1689` — `await page.locator('.ant-popover').first().waitFor({ state: 'visible' });`
- `1710` — `await page.locator('.ant-popover').first().waitFor({ state: 'visible' });`
- `2064` — `await page.getByRole('tab').nth(1).click();`
- `2366` — `await page.getByTestId('breadcrumb').getByRole('link').last().click();`
- `2440` — `page .getByTestId('explore-tree') .getByRole('row') .filter({ hasText: serviceType }) .first()`
- `2494` — `return page .getByTestId('databaseSchema-tables') .locator('[data-testid="column-name"] a') .first();`

## utils/entityPanel.ts  (2)

- `187` — `: page .locator('[data-testid^="table-data-card"]') .filter({ has: page.getByTestId('entity-link').filter({ hasText: entityName }), }) .first();`
- `372` — `: page.locator('[data-testid^="tree-node-"]').first();`

## utils/entityPermissionUtils.ts  (1)

- `171` — `testUserPage.locator(`[data-testid="${testId}"]`).first()`

## utils/explore.ts  (1)

- `292` — `const columnSuggestion = suggestionsContainer .locator('.suggestion-item') .filter({ hasText: columnName }) .filter({ hasText: tableName }) .first();`

## utils/glossary.ts  (7)

- `208` — `await sidebar.getByRole('link').first().waitFor();`
- `234` — `const glossaryTermEntry = page.getByTestId(glossaryTermName).first();`
- `825` — `const firstOption = options.first();`
- `995` — `const dragLocator = page .locator('tr') .filter({ hasText: dragElement }) .first();`
- `1003` — `? page.locator('th:has-text("Terms")').first()`
- `1004` — `: page.locator('tr').filter({ hasText: dropTarget }).first();`
- `1421` — `await page.getByTestId('approve-button').first().click();`

## utils/incidentManager.ts  (8)

- `175` — `const taskTabEditAssigneesButton = page.getByTestId('edit-assignees').last();`
- `189` — `const assigneeModal = page.locator('.ant-modal-content').last();`
- `192` — `const assigneeInput = assigneeSelect.locator('input').last();`
- `193` — `const assigneeOption = page.getByTestId(user.name).first();`
- `194` — `const normalizedAssigneeOption = page .getByTestId(user.name.toLowerCase()) .first();`
- `229` — `: page.getByTestId('assignee').first()`
- `270` — `: page.getByTestId('assignee').first();`
- `291` — `const incidentLink = page .getByRole('link', { name: testCaseName }) .first();`

## utils/lineage.ts  (1)

- `1014` — `await page.getByRole('button', { name: 'Full Screen View' }).first().click();`

## utils/logsViewer.ts  (3)

- `399` — `const bundleSuiteLink = page .getByTestId('test-suite-table') .locator(`a[href*="${encodedBundleSuiteFqn}"]`) .first();`
- `437` — `const row = page .getByRole('row') .filter({ has: page.getByTestId('logs-button') }) .first();`
- `442` — `const statusBadge = row.getByTestId('pipeline-status').last();`

## utils/navbar.ts  (2)

- `131` — `const isOptionVisible = await optionLocator .first()`
- `137` — `await optionLocator.first().click();`

## utils/reviewerWorkflow.utils.ts  (1)

- `326` — `const taskCard = dataConsumerPage.getByTestId('task-feed-card').first();`

## utils/searchSettingUtils.ts  (1)

- `162` — `const firstFieldHeader = page.getByTestId('field-container-header').first();`

## utils/service.ts  (1)

- `64` — `await page.getByRole('tab').nth(1).click();`

## utils/sso-providers/keycloak-saml.ts  (3)

- `118` — `const usernameInput = page .locator('input#username, input[name="username"]') .first();`
- `125` — `const passwordInput = page .locator('input#password, input[name="password"]') .first();`
- `132` — `const loginButton = page .locator( 'input#kc-login, button[name="login"], input[type="submit"], button[type="submit"]' ) .first();`

## utils/sso.ts  (7)

- `138` — `await page.getByLabel('Authority').first().fill(config.authority);`
- `139` — `await page.getByLabel('Client ID').first().fill(config.clientId);`
- `140` — `await page.getByLabel('Callback URL').first().fill(config.callbackUrl);`
- `188` — `await page .getByLabel('Principal Domain') .first()`
- `218` — `await botPrincipalsField.first().click();`
- `220` — `await botPrincipalsField.first().locator('input').fill(principal);`
- `221` — `await botPrincipalsField.first().locator('input').press('Enter');`

## utils/task.ts  (3)

- `205` — `const dropdownValue = page.getByTestId(`tag-${value.tag ?? tag}`).first();`
- `226` — `const openTaskItem = page .locator('.task-tab-custom-dropdown .task-count-text') .first();`
- `232` — `const closedTaskItem = page .locator('.task-tab-custom-dropdown .task-count-text') .last();`

## utils/taskWorkflow.ts  (3)

- `669` — `const commentInput = visibleModal.locator('textarea').last();`
- `718` — `const commentInput = visibleTaskModal.locator('textarea').last();`
- `723` — `const confirmButton = visibleTaskModal .getByRole('button', { name: /approve|accept|ok|save/i }) .last();`

## utils/team.ts  (2)

- `54` — `const addTeamModal = page.locator(ADD_TEAM_MODAL).last();`
- `526` — `(await matchingCells .first()`

## utils/testCases.ts  (11)

- `820` — `await expect(cellDetails.nth(0)).toContainText('Entity created');`
- `821` — `await expect(cellDetails.nth(1)).toContainText('Entity created');`
- `822` — `await expect(cellDetails.nth(2)).toContainText(`
- `825` — `await expect(cellDetails.nth(3)).toContainText(`
- `828` — `await expect(cellDetails.nth(4)).toContainText(`
- `869` — `const displayNameCell1 = page .locator('.rdg-row') .nth(0)`
- `878` — `await page.locator('.rdg-row').nth(1).click();`
- `879` — `const displayNameCell2 = page .locator('.rdg-row') .nth(1)`
- `890` — `await page .locator('.rdg-row') .nth(0)`
- `907` — `await expect(cellDetails.nth(0)).toContainText('Entity created');`
- `908` — `await expect(cellDetails.nth(1)).toContainText('Entity created');`

## utils/userDetails.ts  (4)

- `23` — `await page.getByTestId('profile-avatar').first().hover();`
- `52` — `const teamDropdown = page.locator('.ant-tree-select-dropdown').last();`
- `55` — `const directTeamOption = teamDropdown .locator('.ant-select-tree-title') .filter({ hasText: new RegExp(`^${teamName}$`) }) .first();`
- `67` — `await teamSelect.locator('input:not([disabled])').first().click();`
