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
import { CloseOutlined, RightOutlined } from '@ant-design/icons';
import { Box, Chip, IconButton, useTheme } from '@mui/material';
import { ChevronDown, ChevronUp } from '@untitledui/icons';
import { Card, Drawer, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnIcon } from '../../../assets/svg/ic-column-new.svg';
import { ReactComponent as KeyIcon } from '../../../assets/svg/icon-key.svg';
import { EntityType } from '../../../enums/entity.enum';
import { Column, TableConstraint } from '../../../generated/entity/data/table';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { updateTableColumn } from '../../../rest/tableAPI';
import { listTestCases } from '../../../rest/testAPI';
import { calculateTestCaseStatusCounts } from '../../../utils/DataQuality/DataQualityUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import {
  buildColumnBreadcrumbPath,
  findOriginalColumnIndex,
  flattenColumns,
  generateEntityLink,
  getDataTypeDisplay,
  mergeGlossaryWithTags,
  mergeTagsWithGlossary,
  normalizeTags,
} from '../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import DataQualitySection from '../../common/DataQualitySection/DataQualitySection';
import DescriptionSection from '../../common/DescriptionSection/DescriptionSection';
import GlossaryTermsSection from '../../common/GlossaryTermsSection/GlossaryTermsSection';
import Loader from '../../common/Loader/Loader';
import TagsSection from '../../common/TagsSection/TagsSection';
import EntityRightPanelVerticalNav from '../../Entity/EntityRightPanel/EntityRightPanelVerticalNav';
import { EntityRightPanelTab } from '../../Entity/EntityRightPanel/EntityRightPanelVerticalNav.interface';
import CustomPropertiesSection from '../../Explore/EntitySummaryPanel/CustomPropertiesSection/CustomPropertiesSection';
import DataQualityTab from '../../Explore/EntitySummaryPanel/DataQualityTab/DataQualityTab';
import { LineageTabContent } from '../../Explore/EntitySummaryPanel/LineageTab';
import { LineageData } from '../../Lineage/Lineage.interface';
import {
  ColumnDetailPanelProps,
  ColumnOrTask,
  TestCaseStatusCounts,
} from './ColumnDetailPanel.interface';
import './ColumnDetailPanel.less';
import { KeyProfileMetrics } from './KeyProfileMetrics';
import { NestedColumnsSection } from './NestedColumnsSection';

const isColumn = (item: ColumnOrTask | null): item is Column => {
  return item !== null && 'dataType' in item;
};

export const ColumnDetailPanel = <T extends ColumnOrTask = Column>({
  column,
  tableFqn,
  isOpen,
  onClose,
  onColumnUpdate,
  updateColumnDescription,
  updateColumnTags,
  onColumnFieldUpdate,
  hasEditPermission: hasEditPermissionProp = {},
  hasViewPermission: hasViewPermissionProp = {},
  permissions,
  deleted = false,
  allColumns = [],
  onNavigate,
  tableConstraints = [],
  entityType = EntityType.TABLE,
}: ColumnDetailPanelProps<T>) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [isDescriptionLoading, setIsDescriptionLoading] = useState(false);
  const [isTestCaseLoading, setIsTestCaseLoading] = useState(false);

  const hasEditPermission = useMemo(() => {
    if (permissions) {
      return {
        tags: (permissions.EditTags || permissions.EditAll) && !deleted,
        glossaryTerms:
          (permissions.EditGlossaryTerms || permissions.EditAll) && !deleted,
        description:
          (permissions.EditDescription || permissions.EditAll) && !deleted,
        viewAllPermission: permissions.ViewAll,
      };
    }

    return hasEditPermissionProp;
  }, [permissions, deleted, hasEditPermissionProp]);

  const hasViewPermission = useMemo(() => {
    if (permissions) {
      return {
        customProperties: permissions.ViewAll || permissions.ViewCustomFields,
      };
    }

    return hasViewPermissionProp;
  }, [permissions, hasViewPermissionProp]);
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

  const breadcrumbPath = useMemo(() => {
    if (!isColumn(column)) {
      return [];
    }

    return buildColumnBreadcrumbPath(column, allColumns as Column[]);
  }, [column, allColumns]);

  const nestedColumns = useMemo(() => {
    if (!isColumn(column)) {
      return [];
    }

    return column.children || [];
  }, [column]);

  const handleNestedColumnClick = useCallback(
    (nestedColumn: Column) => {
      if (!onNavigate) {
        return;
      }

      const targetIndex = flattenedColumns.findIndex(
        (col) => col.fullyQualifiedName === nestedColumn.fullyQualifiedName
      );

      const originalIndex = findOriginalColumnIndex(
        nestedColumn as T,
        allColumns ?? []
      );

      onNavigate(
        nestedColumn as T,
        originalIndex >= 0 ? originalIndex : targetIndex
      );
    },
    [flattenedColumns, allColumns, onNavigate]
  );

  const handleDescriptionUpdate = useCallback(
    async (newDescription: string) => {
      if (!column?.fullyQualifiedName) {
        return;
      }

      try {
        setIsDescriptionLoading(true);

        let response: T | undefined;

        if (onColumnFieldUpdate) {
          response = await onColumnFieldUpdate(column.fullyQualifiedName, {
            description: newDescription,
          });
        } else if (updateColumnDescription) {
          response = await updateColumnDescription(
            column.fullyQualifiedName,
            newDescription
          );
        } else {
          response = (await updateTableColumn(column.fullyQualifiedName, {
            description: newDescription,
          })) as T;
        }

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.description'),
          })
        );

        // Only call onColumnUpdate if onColumnFieldUpdate is not used
        // onColumnFieldUpdate already handles state updates in the parent
        if (onColumnUpdate && response && !onColumnFieldUpdate) {
          onColumnUpdate(response);
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
    [column, t, onColumnUpdate, updateColumnDescription, onColumnFieldUpdate]
  );

  const handleTagsUpdate = useCallback(
    async (updatedTags: TagLabel[]) => {
      if (!column?.fullyQualifiedName) {
        return;
      }

      try {
        // When clearing classification tags (updatedTags is empty), preserve glossary terms and tier tags
        // When updating tags, merge with existing glossary tags to preserve them
        // Normalize tags to ensure consistent format and prevent backend patch index errors
        const allTags =
          updatedTags.length === 0
            ? // Clear all classification tags but preserve glossary terms and tier tags
              normalizeTags(
                (column.tags ?? []).filter(
                  (tag) =>
                    tag.source === TagSource.Glossary ||
                    (tag.tagFQN?.startsWith('Tier.') ?? false)
                )
              )
            : // Merge updated classification tags with existing glossary tags
              normalizeTags(
                (mergeTagsWithGlossary(column.tags, updatedTags) ??
                  []) as TagLabel[]
              );

        let response: T | undefined;

        if (onColumnFieldUpdate) {
          response = await onColumnFieldUpdate(column.fullyQualifiedName, {
            tags: allTags ?? [],
          });
        } else if (updateColumnTags) {
          response = await updateColumnTags(
            column.fullyQualifiedName,
            allTags ?? []
          );
        } else {
          response = (await updateTableColumn(column.fullyQualifiedName, {
            tags: allTags ?? [],
          })) as T;
        }

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.tag-plural'),
          })
        );

        // Only call onColumnUpdate if onColumnFieldUpdate is not used
        // onColumnFieldUpdate already handles state updates in the parent
        if (onColumnUpdate && response && !onColumnFieldUpdate) {
          onColumnUpdate(response);
        }

        return response?.tags;
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
    [column, t, onColumnUpdate, updateColumnTags, onColumnFieldUpdate]
  );

  const handleGlossaryTermsUpdate = useCallback(
    async (updatedGlossaryTerms: TagLabel[]) => {
      if (!column?.fullyQualifiedName) {
        return;
      }

      try {
        // If updatedGlossaryTerms is empty, respect the clear operation and don't merge with existing tags
        // Otherwise, merge with existing non-glossary tags to preserve them
        // Normalize tags to ensure consistent format and prevent backend patch index errors
        const allTags =
          updatedGlossaryTerms.length === 0
            ? normalizeTags(
                column.tags?.filter(
                  (tag) => tag.source !== TagSource.Glossary
                ) || []
              )
            : normalizeTags(
                (mergeGlossaryWithTags(column.tags, updatedGlossaryTerms) ??
                  []) as TagLabel[]
              );

        let response: T | undefined;

        if (onColumnFieldUpdate) {
          response = await onColumnFieldUpdate(column.fullyQualifiedName, {
            tags: allTags ?? [],
          });
        } else if (updateColumnTags) {
          response = await updateColumnTags(
            column.fullyQualifiedName,
            allTags ?? []
          );
        } else {
          response = (await updateTableColumn(column.fullyQualifiedName, {
            tags: allTags ?? [],
          })) as T;
        }

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.glossary-term-plural'),
          })
        );

        // Only call onColumnUpdate if onColumnFieldUpdate is not used
        // onColumnFieldUpdate already handles state updates in the parent
        if (onColumnUpdate && response && !onColumnFieldUpdate) {
          onColumnUpdate(response);
        }

        return response?.tags;
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
    [column, t, onColumnUpdate, updateColumnTags, onColumnFieldUpdate]
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

        {isColumn(column) && entityType === EntityType.TABLE && (
          <KeyProfileMetrics
            columnFqn={column.fullyQualifiedName}
            tableFqn={tableFqn}
          />
        )}

        {isColumn(column) && (
          <NestedColumnsSection
            columns={nestedColumns}
            onColumnClick={handleNestedColumnClick}
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
            hasViewPermission?.customProperties ?? false
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
        {breadcrumbPath.length > 1 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexWrap: 'wrap',
              marginBottom: 1,
            }}>
            {breadcrumbPath.map((breadcrumb, index) => (
              <Box
                key={breadcrumb.fullyQualifiedName}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Typography.Text
                  style={{ fontSize: 12, color: '#6B7280', fontWeight: 400 }}>
                  {getEntityName(breadcrumb)}
                </Typography.Text>
                {index < breadcrumbPath.length - 1 && (
                  <RightOutlined style={{ fontSize: 10, color: '#9CA3AF' }} />
                )}
              </Box>
            ))}
          </Box>
        )}
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
              <IconButton data-testid="close-button" onClick={onClose}>
                <CloseOutlined
                  color={theme.palette.allShades?.gray?.[600]}
                  height={16}
                  width={16}
                />
              </IconButton>
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
            <IconButton
              disabled={isPreviousDisabled}
              sx={{
                height: 6,
                width: 6,
                backgroundColor: theme.palette.allShades?.white,
                padding: 4,
              }}
              onClick={handlePreviousColumn}>
              <ChevronUp
                color={theme.palette.allShades?.gray?.[600]}
                height={16}
                width={16}
              />
            </IconButton>
            <IconButton
              disabled={isNextDisabled}
              sx={{
                height: 6,
                width: 6,
                padding: 4,
                backgroundColor: theme.palette.allShades?.white,
              }}
              onClick={handleNextColumn}>
              <ChevronDown
                color={theme.palette.allShades?.gray?.[600]}
                height={16}
                width={16}
              />
            </IconButton>
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
      width={576}
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
              isColumnDetailPanel
              activeTab={activeTab}
              entityType={entityType}
              verticalNavConatinerclassName="column-detail-panel-vertical-nav"
              onTabChange={handleTabChange}
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
};
