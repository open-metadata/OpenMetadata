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
import { CloseOutlined } from '@ant-design/icons';
import { Chip } from '@mui/material';
import { Button, Card, Drawer, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowSvg } from '../../../assets/svg/down-arrow-icon.svg';
import { ReactComponent as ColumnIcon } from '../../../assets/svg/ic-column-new.svg';
import { ReactComponent as KeyIcon } from '../../../assets/svg/icon-key.svg';
import { ReactComponent as ArrowUp } from '../../../assets/svg/up-arrow-icon.svg';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { Column, TableConstraint } from '../../../generated/entity/data/table';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { updateTableColumn } from '../../../rest/tableAPI';
import { listTestCases } from '../../../rest/testAPI';
import { calculateTestCaseStatusCounts } from '../../../utils/DataQuality/DataQualityUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import {
  findOriginalColumnIndex,
  flattenColumns,
  generateEntityLink,
  getDataTypeDisplay,
  mergeGlossaryWithTags,
  mergeTagsWithGlossary,
} from '../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import EntityRightPanelVerticalNav from '../../Entity/EntityRightPanel/EntityRightPanelVerticalNav';
import { EntityRightPanelTab } from '../../Entity/EntityRightPanel/EntityRightPanelVerticalNav.interface';
import CustomPropertiesSection from '../../Explore/EntitySummaryPanel/CustomPropertiesSection/CustomPropertiesSection';
import DataQualityTab from '../../Explore/EntitySummaryPanel/DataQualityTab/DataQualityTab';
import { LineageTabContent } from '../../Explore/EntitySummaryPanel/LineageTab';
import { LineageData } from '../../Lineage/Lineage.interface';
import DataQualitySection from '../../common/DataQualitySection/DataQualitySection';
import DescriptionSection from '../../common/DescriptionSection/DescriptionSection';
import GlossaryTermsSection from '../../common/GlossaryTermsSection/GlossaryTermsSection';
import Loader from '../../common/Loader/Loader';
import TagsSection from '../../common/TagsSection/TagsSection';
import {
  ColumnDetailPanelProps,
  ColumnOrTask,
  TestCaseStatusCounts,
} from './ColumnDetailPanel.interface';
import './ColumnDetailPanel.less';

const isColumn = (item: ColumnOrTask | null): item is Column => {
  return item !== null && 'dataType' in item;
};

export const ColumnDetailPanel = <T extends ColumnOrTask = Column>({
  column,
  isOpen,
  onClose,
  onColumnUpdate,
  updateColumnDescription,
  updateColumnTags,
  hasEditPermission = {},
  allColumns = [],
  onNavigate,
  tableConstraints = [],
  entityType = EntityType.TABLE,
}: ColumnDetailPanelProps<T>) => {
  const { t } = useTranslation();
  const [isDescriptionLoading, setIsDescriptionLoading] = useState(false);
  const [isTestCaseLoading, setIsTestCaseLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<EntityRightPanelTab>(
    EntityRightPanelTab.OVERVIEW
  );
  const [statusCounts, setStatusCounts] = useState<TestCaseStatusCounts>({
    success: 0,
    failed: 0,
    aborted: 0,
    total: 0,
  });
  const [lineageData] = useState<LineageData | null>(null);
  const [isLineageLoading] = useState<boolean>(false);
  const [lineageFilter, setLineageFilter] = useState<'upstream' | 'downstream'>(
    'downstream'
  );
  const fetchTestCases = useCallback(async () => {
    if (!column?.fullyQualifiedName) {
      setIsTestCaseLoading(false);

      return;
    }

    try {
      setIsTestCaseLoading(true);
      const entityLink = generateEntityLink(column.fullyQualifiedName);

      const response = await listTestCases({
        entityLink,
        includeAllTests: true,
        limit: 100,
        fields: ['testCaseResult', 'incidentId'],
      });

      const counts = calculateTestCaseStatusCounts(response.data || []);
      setStatusCounts(counts);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setStatusCounts({ success: 0, failed: 0, aborted: 0, total: 0 });
    } finally {
      setIsTestCaseLoading(false);
    }
  }, [column?.fullyQualifiedName]);

  useEffect(() => {
    if (isOpen && column) {
      fetchTestCases();
    }
  }, [isOpen, column, fetchTestCases]);

  // Flatten all columns including nested children for accurate counting and navigation
  const flattenedColumns = useMemo(
    () => flattenColumns(allColumns as Column[]),
    [allColumns]
  );

  // Find the actual index in the flattened array
  const actualColumnIndex = useMemo(() => {
    if (!column?.fullyQualifiedName) {
      return 0;
    }

    return flattenedColumns.findIndex(
      (col) => col.fullyQualifiedName === column.fullyQualifiedName
    );
  }, [column, flattenedColumns]);

  const handleDescriptionUpdate = useCallback(
    async (newDescription: string) => {
      if (!column?.fullyQualifiedName) {
        return;
      }

      try {
        setIsDescriptionLoading(true);

        // Use provided update function or fall back to default table API
        const updateFn =
          updateColumnDescription ||
          ((fqn: string, description: string) =>
            updateTableColumn(fqn, { description }));

        const response = await updateFn(
          column.fullyQualifiedName,
          newDescription
        );

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.description'),
          })
        );

        if (onColumnUpdate) {
          onColumnUpdate(response as T);
        }
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.description'),
          })
        );
      } finally {
        setIsDescriptionLoading(false);
      }
    },
    [column, t, onColumnUpdate, updateColumnDescription]
  );

  const handleTagsUpdate = useCallback(
    async (updatedTags: TagLabel[]) => {
      if (!column?.fullyQualifiedName) {
        return;
      }

      try {
        // Preserve glossary terms when updating classification tags
        const allTags = mergeTagsWithGlossary(column.tags, updatedTags);

        // Use provided update function or fall back to default table API
        const updateFn =
          updateColumnTags ||
          ((fqn: string, tags: TagLabel[]) =>
            updateTableColumn(fqn, { tags }) as Promise<T>);

        const response = await updateFn(
          column.fullyQualifiedName,
          allTags ?? []
        );

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.tag-plural'),
          })
        );

        if (onColumnUpdate) {
          onColumnUpdate(response);
        }

        return response.tags;
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.tag-plural'),
          })
        );

        throw error;
      }
    },
    [column, t, onColumnUpdate, updateColumnTags]
  );

  const handleGlossaryTermsUpdate = useCallback(
    async (updatedGlossaryTerms: TagLabel[]) => {
      if (!column?.fullyQualifiedName) {
        return;
      }

      try {
        const allTags = mergeGlossaryWithTags(
          column.tags,
          updatedGlossaryTerms
        );

        // Use provided update function or fall back to default table API
        const updateFn =
          updateColumnTags ||
          ((fqn: string, tags: TagLabel[]) =>
            updateTableColumn(fqn, { tags }) as Promise<T>);

        const response = await updateFn(
          column.fullyQualifiedName,
          allTags ?? []
        );

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.glossary-term-plural'),
          })
        );

        if (onColumnUpdate) {
          onColumnUpdate(response);
        }

        return response.tags;
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.glossary-term-plural'),
          })
        );

        throw error;
      }
    },
    [column, t, onColumnUpdate, updateColumnTags]
  );

  useEffect(() => {
    if (isOpen && column) {
      setActiveTab(EntityRightPanelTab.OVERVIEW);
    }
  }, [isOpen, column]);

  const handleTabChange = (tab: EntityRightPanelTab) => {
    setActiveTab(tab);
  };

  const handleColumnNavigation = useCallback(
    (direction: 'previous' | 'next') => {
      if (!onNavigate) {
        return;
      }

      const isPrevious = direction === 'previous';
      const canNavigate = isPrevious
        ? actualColumnIndex > 0
        : actualColumnIndex < flattenedColumns.length - 1;

      if (!canNavigate) {
        return;
      }

      const targetIndex = isPrevious
        ? actualColumnIndex - 1
        : actualColumnIndex + 1;
      const targetColumn = flattenedColumns[targetIndex];
      const originalIndex = findOriginalColumnIndex(
        targetColumn as T,
        allColumns ?? []
      );

      onNavigate(
        targetColumn as T,
        originalIndex >= 0 ? originalIndex : targetIndex
      );
    },
    [actualColumnIndex, flattenedColumns, allColumns, onNavigate]
  );

  const handlePreviousColumn = useCallback(
    () => handleColumnNavigation('previous'),
    [handleColumnNavigation]
  );

  const handleNextColumn = useCallback(
    () => handleColumnNavigation('next'),
    [handleColumnNavigation]
  );

  const isPreviousDisabled = actualColumnIndex === 0;
  const isNextDisabled = actualColumnIndex === flattenedColumns.length - 1;

  const dataQualityTests = useMemo(
    () => [
      { type: 'success' as const, count: statusCounts.success },
      { type: 'aborted' as const, count: statusCounts.aborted },
      { type: 'failed' as const, count: statusCounts.failed },
    ],
    [statusCounts]
  );

  const classificationTags = useMemo(
    () =>
      column?.tags?.filter((tag) => tag.source !== TagSource.Glossary) || [],
    [column?.tags]
  );

  const renderOverviewTab = () => {
    return (
      <Space className="w-full" direction="vertical" size="large">
        {isDescriptionLoading ? (
          <div className="flex-center p-lg">
            <Loader size="small" />
          </div>
        ) : (
          <DescriptionSection
            description={column?.description}
            hasPermission={hasEditPermission?.description ?? false}
            onDescriptionUpdate={handleDescriptionUpdate}
          />
        )}

        {isTestCaseLoading ? (
          <Loader size="small" />
        ) : (
          statusCounts.total > 0 && (
            <DataQualitySection
              tests={dataQualityTests}
              totalTests={statusCounts.total}
            />
          )
        )}

        <GlossaryTermsSection
          entityId={column?.fullyQualifiedName || ''}
          entityType={'_column' as EntityType}
          hasPermission={hasEditPermission?.glossaryTerms ?? false}
          maxVisibleGlossaryTerms={3}
          tags={column?.tags}
          onGlossaryTermsUpdate={handleGlossaryTermsUpdate}
        />

        <TagsSection
          entityId={column?.fullyQualifiedName || ''}
          entityType={'_column' as EntityType}
          hasPermission={hasEditPermission?.tags ?? false}
          tags={classificationTags}
          onTagsUpdate={handleTagsUpdate}
        />
      </Space>
    );
  };

  const renderLineageTab = () => {
    if (isLineageLoading) {
      return (
        <div className="flex-center p-lg">
          <Loader size="default" />
        </div>
      );
    }

    if (!lineageData) {
      return (
        <div className="text-center text-grey-muted p-lg">
          {t('label.no-data-found')}
        </div>
      );
    }

    return (
      <LineageTabContent
        entityFqn={column?.fullyQualifiedName || ''}
        filter={lineageFilter}
        lineageData={lineageData}
        onFilterChange={setLineageFilter}
      />
    );
  };

  const renderCustomPropertiesTab = () => {
    if (!column?.fullyQualifiedName) {
      return null;
    }

    return (
      <div className="overview-tab-content">
        <CustomPropertiesSection
          entityData={
            column as unknown as { extension?: Record<string, unknown> }
          }
          entityDetails={{ details: column }}
          entityType={entityType}
          isEntityDataLoading={false}
          viewCustomPropertiesPermission={
            hasEditPermission.customProperties ?? false
          }
        />
      </div>
    );
  };
  const isPrimaryKey = useMemo(() => {
    if (!column?.name) {
      return false;
    }

    return tableConstraints.some(
      (constraint: TableConstraint) =>
        constraint.constraintType === 'PRIMARY_KEY' &&
        constraint.columns?.includes(column.name)
    );
  }, [column?.name, tableConstraints]);

  const columnTitle = column ? (
    <div className="title-section">
      <div className="title-container items-start">
        <Tooltip
          mouseEnterDelay={0.5}
          placement="topLeft"
          title={column.displayName || column.name}
          trigger="hover">
          <div className="d-flex items-center justify-between w-full">
            <div className="d-flex items-center gap-2">
              <span className="entity-icon">
                <ColumnIcon />
              </span>
              <Typography.Text
                className="entity-title-link"
                data-testid="entity-link"
                ellipsis={{ tooltip: true }}>
                {stringToHTML(getEntityName(column))}
              </Typography.Text>
            </div>
            <div>
              <Button
                data-testid="close-button"
                icon={<CloseOutlined />}
                size="small"
                type="text"
                onClick={onClose}
              />
            </div>
          </div>
        </Tooltip>
        <div className="d-flex items-center gap-2">
          {isColumn(column) && getDataTypeDisplay(column) && (
            <Chip
              className="data-type-chip"
              label={getDataTypeDisplay(column) || ''}
              size="small"
              variant="outlined"
            />
          )}
          {isColumn(column) && isPrimaryKey && (
            <Chip
              className="data-type-chip"
              icon={<KeyIcon height={12} width={12} />}
              label={t('label.primary-key')}
              size="small"
              variant="outlined"
            />
          )}
        </div>
      </div>
    </div>
  ) : null;

  const renderTabContent = () => {
    if (!column) {
      return null;
    }

    switch (activeTab) {
      case EntityRightPanelTab.DATA_QUALITY:
        return (
          <DataQualityTab
            isColumnDetailPanel
            entityFQN={column.fullyQualifiedName || ''}
            entityType={entityType as string}
          />
        );
      case EntityRightPanelTab.LINEAGE:
        return <div className="overview-tab-content">{renderLineageTab()}</div>;
      case EntityRightPanelTab.CUSTOM_PROPERTIES:
        return (
          <div className="overview-tab-content">
            {renderCustomPropertiesTab()}
          </div>
        );
      case EntityRightPanelTab.OVERVIEW:
      default:
        return (
          <div className="overview-tab-content">{renderOverviewTab()}</div>
        );
    }
  };

  if (!column) {
    return null;
  }

  return (
    <Drawer
      className="column-detail-panel"
      closable={false}
      footer={
        <div className="d-flex justify-between items-center w-full navigation-container">
          <div className="d-flex items-center gap-1 m-t-sm">
            <Button
              disabled={isPreviousDisabled}
              icon={<ArrowUp />}
              size="small"
              type="text"
              onClick={handlePreviousColumn}
            />
            <Button
              disabled={isNextDisabled}
              icon={<ArrowSvg />}
              size="small"
              type="text"
              onClick={handleNextColumn}
            />
            <Typography.Text className="pagination-header-text text-medium">
              {actualColumnIndex + 1} {t('label.of-lowercase')}{' '}
              {flattenedColumns.length} {t('label.column-plural').toLowerCase()}
            </Typography.Text>
          </div>
        </div>
      }
      open={isOpen}
      placement="right"
      title={columnTitle}
      width={480}
      onClose={onClose}>
      <div className="column-detail-panel-container">
        <div className="d-flex gap-2">
          <Card bordered={false} className="summary-panel-container">
            <Card className="content-area" style={{ width: '100%' }}>
              {renderTabContent()}
            </Card>
          </Card>
          <div className="m-r-sm">
            <EntityRightPanelVerticalNav
              activeTab={activeTab}
              entityType={TabSpecificField.COLUMNS}
              verticalNavConatinerclassName="column-detail-panel-vertical-nav"
              onTabChange={handleTabChange}
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
};
