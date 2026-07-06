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

import { Button, Card, Col, Row, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { TEST_DEFINITION_FILTERS } from '../../../constants/TestDefinition.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { useFilterSelection } from '../../common/atoms/filters/useFilterSelection';
import {
  SelectMode,
  useQuickFiltersWithComponent,
} from '../../common/atoms/filters/useQuickFiltersWithComponent';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { LearningIcon } from '../../Learning/LearningIcon/LearningIcon.component';
import EntityDeleteModal from '../../Modals/EntityDeleteModal/EntityDeleteModal';
import TestDefinitionForm from '../TestDefinitionForm/TestDefinitionForm.component';
import TestDefinitionTable from './TestDefinitionTable.component';
import { useTestDefinitionListPage } from './useTestDefinitionListPage';

const TestDefinitionList = () => {
  const { t } = useTranslation();
  const {
    testDefinitions,
    isLoading,
    createPermission,
    viewPermission,
    testDefinitionPermissions,
    permissionLoading,
    currentPage,
    pageSize,
    pagingData,
    showPagination,
    urlFilters,
    parsedFilters,
    handleFilterChange,
    isFormVisible,
    selectedDefinition,
    isDeleteModalVisible,
    definitionToDelete,
    openCreateForm,
    handleEnableToggle,
    handleEdit,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleFormSuccess,
    handleFormCancel,
  } = useTestDefinitionListPage();

  const { quickFilters } = useQuickFiltersWithComponent({
    defaultFilters: TEST_DEFINITION_FILTERS.map((f) => ({
      ...f,
      value: [],
      hideCounts: true,
    })),
    parsedFilters,
    searchIndex: SearchIndex.ALL,
    onFilterChange: handleFilterChange,
    mode: SelectMode.SINGLE,
  });

  const { filterSelectionDisplay } = useFilterSelection({
    urlState: {
      filters: urlFilters,
      searchQuery: '',
      currentPage,
      pageSize,
    },
    filterConfigs: TEST_DEFINITION_FILTERS,
    parsedFilters,
    onFilterChange: handleFilterChange,
  });

  if (!viewPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <>
      <Row className="p-b-md" gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Row justify="space-between">
              <Col>
                <div className="flex gap-2 items-center m-b-xss">
                  <Typography.Title className="m-b-0" level={5}>
                    {t('label.data-quality-rule-plural')}
                  </Typography.Title>
                  <LearningIcon
                    pageId={LEARNING_PAGE_IDS.TEST_LIBRARY}
                    title={t('label.data-quality-rule-plural')}
                  />
                </div>
                <Typography.Text type="secondary">
                  {t('message.page-sub-header-for-test-definitions')}
                </Typography.Text>
              </Col>
              {createPermission && (
                <Col>
                  <Button
                    data-testid="add-test-definition-button"
                    type="primary"
                    onClick={openCreateForm}>
                    {t('label.add-entity', {
                      entity: t('label.test-definition'),
                    })}
                  </Button>
                </Col>
              )}
            </Row>
          </Card>
        </Col>

        <Col span={24}>
          <Card
            bodyStyle={{
              padding: 0,
            }}>
            <div className="tw:flex tw:flex-col tw:gap-2 tw:p-4">
              <div className="tw:flex tw:gap-2 tw:items-center">
                {quickFilters}
              </div>
              {!isEmpty(urlFilters) && <div>{filterSelectionDisplay}</div>}
            </div>

            <TestDefinitionTable
              isLoading={isLoading}
              pagingData={pagingData}
              permissionLoading={permissionLoading}
              showPagination={showPagination}
              testDefinitionPermissions={testDefinitionPermissions}
              testDefinitions={testDefinitions}
              onDelete={handleDeleteClick}
              onEdit={handleEdit}
              onEnableToggle={handleEnableToggle}
            />
          </Card>
        </Col>
      </Row>

      {isFormVisible && (
        <TestDefinitionForm
          initialValues={selectedDefinition}
          onCancel={handleFormCancel}
          onSuccess={handleFormSuccess}
        />
      )}

      <EntityDeleteModal
        entityName={getEntityName(definitionToDelete)}
        entityType={t('label.test-definition')}
        visible={isDeleteModalVisible}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
};

export default TestDefinitionList;
