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
  borderAfter,
  Box,
  EmptyPlaceholderAction,
} from '@openmetadata/ui-core-components';
import { ChevronDown, Plus } from '@untitledui/icons';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { useDataQualityProvider } from '../../../../pages/DataQuality/DataQualityProvider';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { TestSuiteListPanel } from '../../../DataQuality/TestSuite/TestSuiteList/TestSuiteListPanel.component';
import { useTestSuitesListPage } from '../../../DataQuality/TestSuite/TestSuiteList/useTestSuitesListPage';
import DqSummaryPanel from '../DqSummaryPanel';

// Mirrors the core `Button` `secondary`/`md` look so the owner trigger (a plain
// element required by the antd Popover) matches the react-aria controls.
const chipTriggerClassName = classNames(
  'tw:inline-flex tw:h-max tw:cursor-pointer tw:items-center tw:justify-center',
  'tw:gap-1 tw:whitespace-nowrap tw:rounded-lg tw:bg-primary tw:px-3.5 tw:py-2.5',
  'tw:text-sm tw:font-medium tw:text-secondary tw:shadow-xs-skeuomorphic',
  // Border on ::after, not a ring: WebKit does not pixel-snap box-shadow, so rings thin or
  // vanish in Safari when zoomed. `tw:outline-brand` is kept because it recolours the native
  // focus ring — drawing the border on the element's own outline would hijack that colour.
  'tw:relative tw:outline-brand tw:transition',
  borderAfter,
  'tw:after:outline-primary',
  'tw:duration-100 tw:ease-linear tw:hover:bg-primary_hover tw:hover:text-secondary_hover'
);

/**
 * App-mode Test Suites tab. Data + API come from the shared useTestSuitesListPage
 * hook and the list (toggle + search + table) is the shared TestSuiteListPanel;
 * this component only supplies the mode chrome above it — the owner filter and the
 * untitled-ui summary panel.
 */
const TestSuites = () => {
  const { t } = useTranslation();
  const { createActions } = useDataQualityProvider();
  const {
    subTab,
    params,
    searchValue,
    selectedOwner,
    ownerFilterValue,
    testSuitePermission,
    sortedData,
    isLoading,
    columnList,
    sortDescriptor,
    setSortDescriptor,
    currentPage,
    pageSize,
    paging,
    showPagination,
    handlePageSizeChange,
    handleTestSuitesPageChange,
    handleSearchParam,
    handleOwnerSelect,
    handleSubTabChange,
    isTestCaseSummaryLoading,
    testCaseSummary,
  } = useTestSuitesListPage();

  const emptyStateAction: EmptyPlaceholderAction | undefined = useMemo(() => {
    let action: EmptyPlaceholderAction | undefined;
    if (
      createActions?.canCreateBundleSuite &&
      createActions?.onAddBundleSuite
    ) {
      action = {
        key: 'new-bundle-suite',
        label: t('label.new-entity', { entity: t('label.bundle-suite') }),
        color: 'primary',
        iconLeading: Plus,
        onPress: createActions.onAddBundleSuite,
      };
    }

    return action;
  }, [createActions?.canCreateBundleSuite, createActions?.onAddBundleSuite, t]);

  if (!testSuitePermission?.ViewAll && !testSuitePermission?.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.test-suite'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <Box direction="col" gap={6}>
      <Box
        align="center"
        data-testid="test-suite-filter-bar"
        gap={3}
        wrap="wrap">
        <UserTeamSelectableList
          hasPermission
          owner={selectedOwner}
          popoverProps={{ placement: 'bottomLeft' }}
          onUpdate={handleOwnerSelect}>
          <button
            className={chipTriggerClassName}
            data-testid="owner-select-filter"
            type="button">
            {ownerFilterValue?.label ?? t('label.owner')}
            <ChevronDown className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
          </button>
        </UserTeamSelectableList>
      </Box>
      <DqSummaryPanel
        isLoading={isTestCaseSummaryLoading}
        testSummary={testCaseSummary}
      />
      <TestSuiteListPanel
        columnList={columnList}
        currentPage={currentPage}
        data={sortedData}
        emptyStateAction={emptyStateAction}
        hasActiveFilters={!isEmpty(params)}
        isLoading={isLoading}
        pageSize={pageSize}
        paging={paging}
        pagingHandler={handleTestSuitesPageChange}
        searchValue={searchValue}
        showPagination={showPagination}
        sortDescriptor={sortDescriptor}
        subTab={subTab}
        onSearch={(value) => handleSearchParam(value, 'searchValue')}
        onShowSizeChange={handlePageSizeChange}
        onSortChange={setSortDescriptor}
        onSubTabChange={handleSubTabChange}
      />
    </Box>
  );
};

export default TestSuites;
