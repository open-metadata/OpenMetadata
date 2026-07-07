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
import { Col, Form, Row, Select, Space } from 'antd';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { getPopupContainer } from '../../../../utils/formPureUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import PieChartSummaryPanel from '../../SummaryPannel/PieChartSummaryPanel.component';
import { TestSuiteListPanel } from './TestSuiteListPanel.component';
import { useTestSuitesListPage } from './useTestSuitesListPage';

export const TestSuites = () => {
  const { t } = useTranslation();
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
    <Row data-testid="test-suite-container" gutter={[16, 16]}>
      <Col span={24}>
        <Form className="new-form-style" layout="inline">
          <Space align="center" className="w-full justify-between" size={16}>
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
          </Space>
        </Form>
      </Col>

      <Col span={24}>
        <PieChartSummaryPanel
          isLoading={isTestCaseSummaryLoading}
          testSummary={testCaseSummary}
        />
      </Col>

      <Col span={24}>
        <TestSuiteListPanel
          columnList={columnList}
          currentPage={currentPage}
          data={sortedData}
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
      </Col>
    </Row>
  );
};
