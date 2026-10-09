/*
 *  Copyright 2023 Collate.
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
  Box,
  EmptyPlaceholderAction,
  Grid,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { Form, Select } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { useDataQualityProvider } from '../../../../pages/DataQuality/DataQualityProvider';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';
import { getPopupContainer } from '../../../../utils/formPureUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import PieChartSummaryPanel from '../../SummaryPannel/PieChartSummaryPanel.component';
import { TestSuiteListPanel } from './TestSuiteListPanel.component';
import { useTestSuitesListPage } from './useTestSuitesListPage';

export const TestSuites = () => {
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

  // testSuitePermission is a resource-level permission (usePermissionProvider().permissions.
  // testSuite, threaded through useTestSuitesListPage/useTestSuitesData — the latter's own
  // consumption of the raw object is out of this batch's scope and stays untouched). Itself
  // OperationPermission-shaped, so it runs through getDerivedPermissionFlags exactly like an
  // entity-level fetch (Task 8 Batch 3 DatabaseSchemaTable.tsx precedent). Falls back to
  // DEFAULT_ENTITY_PERMISSION (all-false) to reproduce the old `?.` optional-chaining
  // undefined-is-falsy behavior.
  const testSuiteFlags = useMemo(
    () =>
      getDerivedPermissionFlags(
        testSuitePermission ?? DEFAULT_ENTITY_PERMISSION
      ),
    [testSuitePermission]
  );

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

  if (!testSuiteFlags.hasViewAccess) {
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
    <Grid
      className="layout-row layout-grid"
      data-testid="test-suite-container"
      style={{ ...getLayoutGutter(16, 16) }}>
      <Grid.Item className="layout-column" span={24}>
        <Form className="new-form-style" layout="inline">
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal w-full justify-between"
            gap={4}
            itemClassName="layout-space-item">
            <Form.Item className="m-0" label={t('label.owner')} name="owner">
              <UserTeamSelectableList
                hasPermission
                owner={selectedOwner}
                popoverProps={{
                  getPopupContainer: getPopupContainer,
                }}
                onUpdate={(updatedUser) => handleOwnerSelect(updatedUser)}>
                <Select
                  data-testid="owner-select-filter"
                  open={false}
                  placeholder={t('label.owner')}
                  value={ownerFilterValue}
                />
              </UserTeamSelectableList>
            </Form.Item>
          </Box>
        </Form>
      </Grid.Item>

      <Grid.Item className="layout-column" span={24}>
        <PieChartSummaryPanel
          isLoading={isTestCaseSummaryLoading}
          testSummary={testCaseSummary}
        />
      </Grid.Item>

      <Grid.Item className="layout-column" span={24}>
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
      </Grid.Item>
    </Grid>
  );
};
