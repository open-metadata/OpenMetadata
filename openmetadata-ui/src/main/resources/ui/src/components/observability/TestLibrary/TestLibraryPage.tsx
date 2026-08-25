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
import { Button } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { getEntityName } from '../../../utils/EntityNameUtils';
import DeleteModal from '../../common/DeleteModal/DeleteModal';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import HeaderShell from '../../common/HeaderShell/HeaderShell.component';
import { LearningIcon } from '../../Learning/LearningIcon/LearningIcon.component';
import TestDefinitionForm from '../../TestLibrary/TestDefinitionForm/TestDefinitionForm.component';
import TestDefinitionTable from '../../TestLibrary/TestDefinitionList/TestDefinitionTable.component';
import { useTestDefinitionListPage } from '../../TestLibrary/TestDefinitionList/useTestDefinitionListPage';
import { getObservabilityRootBreadcrumb } from '../observabilityBreadcrumb.utils';
import ObservabilityPageShell from '../ObservabilityPageShell/ObservabilityPageShell';
import TestDefinitionFilterBar from './TestDefinitionFilterBar';

/**
 * App-mode Test Library page. Composes the shared useTestDefinitionListPage hook
 * (logic) + reused TestDefinitionTable, and supplies the header with the Add
 * action plus the 2.0 labeled-select filter bar. Mirrors the DataQuality
 * pattern: logic and table live once in OSS, only the chrome differs.
 */
const TestLibraryPage = () => {
  const { t } = useTranslation();
  const {
    testDefinitions,
    isLoading,
    createPermission,
    viewPermission,
    testDefinitionPermissions,
    permissionLoading,
    pagingData,
    showPagination,
    urlFilters,
    setSingleFilter,
    clearAllFilters,
    hasActiveFilters,
    isFormVisible,
    selectedDefinition,
    isDeleteModalVisible,
    isDeleting,
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

  if (!viewPermission) {
    return (
      <ErrorPlaceHolder
        permissionValue={t('label.view-entity', {
          entity: t('label.test-definition'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <>
      <ObservabilityPageShell
        header={
          <HeaderShell
            actions={
              createPermission ? (
                <Button
                  color="primary"
                  data-testid="add-test-definition-button"
                  iconLeading={Plus}
                  size="md"
                  onPress={openCreateForm}>
                  {t('label.add-entity', {
                    entity: t('label.test-definition'),
                  })}
                </Button>
              ) : undefined
            }
            badge={
              <LearningIcon
                pageId={LEARNING_PAGE_IDS.TEST_LIBRARY}
                title={t('label.test-library')}
              />
            }
            breadcrumb={
              <HeaderBreadcrumb
                noMargin
                className="tw:text-xs"
                items={[
                  getObservabilityRootBreadcrumb(t),
                  {
                    label: t('label.test-library'),
                    ariaLabel: t('label.test-library'),
                  },
                ]}
                showHome={false}
              />
            }
            padding="comfortable"
            subtitle={t('message.page-sub-header-for-test-definitions')}
            title={t('label.test-library')}
            variant="gradient"
          />
        }
        pageTitle={t('label.test-library')}>
        <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-border-secondary tw:bg-primary">
          <div className="tw:p-4">
            <TestDefinitionFilterBar
              filterValues={urlFilters}
              hasActiveFilters={hasActiveFilters}
              onClearAll={clearAllFilters}
              onFilterChange={setSingleFilter}
            />
          </div>
          <TestDefinitionTable
            hasActiveFilters={hasActiveFilters}
            isLoading={isLoading}
            pagingData={pagingData}
            permissionLoading={permissionLoading}
            showPagination={showPagination}
            testDefinitionPermissions={testDefinitionPermissions}
            testDefinitions={testDefinitions}
            onClearFilters={clearAllFilters}
            onDelete={handleDeleteClick}
            onEdit={handleEdit}
            onEnableToggle={handleEnableToggle}
          />
        </div>
      </ObservabilityPageShell>

      <TestDefinitionForm
        initialValues={selectedDefinition}
        open={isFormVisible}
        variant="modal"
        onCancel={handleFormCancel}
        onSuccess={handleFormSuccess}
      />

      <DeleteModal
        entityTitle={getEntityName(definitionToDelete)}
        isDeleting={isDeleting}
        message={t('message.permanently-delete-common-message', {
          entity: getEntityName(definitionToDelete).toLowerCase(),
        })}
        open={isDeleteModalVisible}
        onCancel={handleDeleteCancel}
        onDelete={handleDeleteConfirm}
      />
    </>
  );
};

export default TestLibraryPage;
