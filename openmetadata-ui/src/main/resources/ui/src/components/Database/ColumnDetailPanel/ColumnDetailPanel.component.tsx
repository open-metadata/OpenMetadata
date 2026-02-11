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
import { Box, Chip, IconButton, useTheme } from '@mui/material';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  XClose,
} from '@untitledui/icons';
import { Button, Card, Drawer, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isString } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as ColumnIcon } from '../../../assets/svg/ic-column-new.svg';
import { ReactComponent as KeyIcon } from '../../../assets/svg/icon-key.svg';
import {
  DE_ACTIVE_COLOR,
  ENTITY_PATH,
  ICON_DIMENSION,
  PAGE_SIZE_LARGE,
} from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { Column, TableConstraint } from '../../../generated/entity/data/table';
import { Type } from '../../../generated/entity/type';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import {
  getTableColumnsByFQN,
  updateTableColumn,
} from '../../../rest/tableAPI';
import { listTestCases } from '../../../rest/testAPI';
import { calculateTestCaseStatusCounts } from '../../../utils/DataQuality/DataQualityUtils';
import { toEntityData } from '../../../utils/EntitySummaryPanelUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getErrorText, stringToHTML } from '../../../utils/StringsUtils';
import {
  buildColumnBreadcrumbPath,
  findOriginalColumnIndex,
  flattenColumns,
  generateEntityLink,
  getDataTypeDisplay,
  mergeTagsWithGlossary,
  normalizeTags,
} from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import AlertBar from '../../AlertBar/AlertBar';
import DataQualitySection from '../../common/DataQualitySection/DataQualitySection';
import DescriptionSection from '../../common/DescriptionSection/DescriptionSection';
import GlossaryTermsSection from '../../common/GlossaryTermsSection/GlossaryTermsSection';
import Loader from '../../common/Loader/Loader';
import TagsSection from '../../common/TagsSection/TagsSection';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import EntityRightPanelVerticalNav from '../../Entity/EntityRightPanel/EntityRightPanelVerticalNav';
import { EntityRightPanelTab } from '../../Entity/EntityRightPanel/EntityRightPanelVerticalNav.interface';
import CustomPropertiesSection from '../../Explore/EntitySummaryPanel/CustomPropertiesSection/CustomPropertiesSection';
import DataQualityTab from '../../Explore/EntitySummaryPanel/DataQualityTab/DataQualityTab';
import { LineageTabContent } from '../../Explore/EntitySummaryPanel/LineageTab';
import { LineageData } from '../../Lineage/Lineage.interface';
import EntityNameModal from '../../Modals/EntityNameModal/EntityNameModal.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import {
  ColumnDetailPanelProps,
  ColumnFieldUpdate,
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
  onColumnFieldUpdate,
  deleted = false,
  allColumns = [],
  onNavigate,
  tableConstraints = [],
  entityType,
  onColumnsUpdate,
}: ColumnDetailPanelProps<T>) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { permissions } = useGenericContext();
  const [isDescriptionLoading, setIsDescriptionLoading] = useState(false);
  const [isTestCaseLoading, setIsTestCaseLoading] = useState(false);
  const [isDisplayNameEditing, setIsDisplayNameEditing] = useState(false);
  const [localToast, setLocalToast] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ open: false, message: '', type: 'success' });

  const hasEditPermission = useMemo(
    () => ({
      tags: (permissions.EditTags || permissions.EditAll) && !deleted,
      glossaryTerms:
        (permissions.EditGlossaryTerms || permissions.EditAll) && !deleted,
      description:
        (permissions.EditDescription || permissions.EditAll) && !deleted,
      viewAllPermission: permissions.ViewAll,
      customProperties:
        (permissions.EditCustomFields || permissions.EditAll) && !deleted,
      displayName:
        (permissions.EditDisplayName || permissions.EditAll) && !deleted,
    }),
    [permissions, deleted]
  );

  const hasViewPermission = useMemo(
    () => ({
      customProperties: permissions.ViewAll || permissions.ViewCustomFields,
    }),
    [permissions]
  );
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

  const [entityTypeDetail, setEntityTypeDetail] = useState<Type>();

  const fetchEntityTypeDetail = async () => {
    try {
      const res = await getTypeByFQN(ENTITY_PATH.column);
      setEntityTypeDetail(res);
    } catch (error) {
      setLocalToast({
        open: true,
        message: getErrorText(error as AxiosError, t('message.error')),
        type: 'error',
      });
    }
  };

  useEffect(() => {
    fetchEntityTypeDetail();
  }, []);

  useEffect(() => {
    if (localToast.open) {
      const timer = setTimeout(() => {
        setLocalToast((prev) => ({ ...prev, open: false }));
      }, 3000);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [localToast]);

  const [activeColumn, setActiveColumn] = useState<T | null>(column);

  useEffect(() => {
    setActiveColumn(column);
  }, [column]);

  const fetchColumnDetails = useCallback(async () => {
    if (!column?.fullyQualifiedName || !isOpen || !tableFqn) {
      return;
    }

    const col = column as Column;
    // If extension is missing, fetch full details using list
    if (entityType === EntityType.TABLE && !col.extension) {
      try {
        const response = await getTableColumnsByFQN(tableFqn, {
          fields: 'tags,customMetrics,extension',
          limit: PAGE_SIZE_LARGE,
        });

        const latestColumn = response.data.find(
          (c) => c.fullyQualifiedName === column.fullyQualifiedName
        );

        if (latestColumn) {
          setActiveColumn((prev) => ({ ...prev, ...latestColumn } as T));
        }

        if (onColumnsUpdate) {
          onColumnsUpdate(response.data);
        }
      } catch (error) {
        // Fallback to existing data if fetch fails
      }
    }
  }, [column?.fullyQualifiedName, isOpen, entityType, tableFqn]);

  useEffect(() => {
    fetchColumnDetails();
  }, [fetchColumnDetails]);

  useEffect(() => {
    if (isOpen && entityType === EntityType.TABLE) {
      fetchTestCases();
    }
  }, [isOpen, activeColumn, fetchTestCases]);

  // Flatten all columns including nested children for accurate counting and navigation
  const flattenedColumns = useMemo(
    () => flattenColumns(allColumns as Column[]),
    [allColumns]
  );

  // Find the actual index in the flattened array and track if column was found
  const { actualColumnIndex, isColumnInList } = useMemo(() => {
    if (!activeColumn?.fullyQualifiedName) {
      return {
        actualColumnIndex: 0,
        isColumnInList: flattenedColumns.length > 0,
      };
    }

    const index = flattenedColumns.findIndex(
      (col) => col.fullyQualifiedName === activeColumn.fullyQualifiedName
    );

    return {
      actualColumnIndex: index === -1 ? 0 : index,
      isColumnInList: index !== -1,
    };
  }, [activeColumn, flattenedColumns]);

  const breadcrumbPath = useMemo(() => {
    if (!isColumn(activeColumn)) {
      return [];
    }

    return buildColumnBreadcrumbPath(activeColumn, allColumns as Column[]);
  }, [activeColumn, allColumns]);

  const nestedColumns = useMemo(() => {
    if (!isColumn(activeColumn)) {
      return [];
    }

    return activeColumn.children || [];
  }, [activeColumn]);

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

  // Common handler for column field updates
  const performColumnFieldUpdate = useCallback(
    async (
      update: ColumnFieldUpdate,
      successMessageKey: string
    ): Promise<T | undefined> => {
      if (!activeColumn?.fullyQualifiedName) {
        return undefined;
      }

      const response = onColumnFieldUpdate
        ? await onColumnFieldUpdate(
            activeColumn.fullyQualifiedName,
            update,
            true
          )
        : // Fallback to direct API call for Table entities when used outside GenericProvider
          ((await updateTableColumn(
            activeColumn.fullyQualifiedName,
            update
          )) as T);

      // Only show success toast if we got a valid response
      if (response) {
        setLocalToast({
          open: true,
          message: t('server.update-entity-success', {
            entity: t(successMessageKey),
          }),
          type: 'success',
        });
      }

      return response;
    },
    [activeColumn?.fullyQualifiedName, t, onColumnFieldUpdate]
  );

  const handleDescriptionUpdate = useCallback(
    async (newDescription: string) => {
      try {
        setIsDescriptionLoading(true);
        await performColumnFieldUpdate(
          { description: newDescription },
          'label.description'
        );
      } catch (error) {
        setLocalToast({
          open: true,
          message:
            getErrorText(error as AxiosError, t('message.error')) ||
            t('server.entity-updating-error', {
              entity: t('label.description'),
            }),
          type: 'error',
        });
      } finally {
        setIsDescriptionLoading(false);
      }
    },
    [performColumnFieldUpdate, t]
  );

  // Prepare tags for classification tag updates (preserve glossary and tier tags)
  const prepareClassificationTags = useCallback(
    (updatedTags: TagLabel[]): TagLabel[] => {
      if (updatedTags.length === 0) {
        // Clear all classification tags but preserve glossary terms and tier tags
        return normalizeTags(
          (activeColumn?.tags ?? []).filter(
            (tag) =>
              tag.source === TagSource.Glossary ||
              (tag.tagFQN?.startsWith('Tier.') ?? false)
          )
        );
      }

      // Merge updated classification tags with existing glossary tags
      return normalizeTags(
        (mergeTagsWithGlossary(activeColumn?.tags, updatedTags) ??
          []) as TagLabel[]
      );
    },
    [activeColumn?.tags]
  );

  const handleTagsUpdate = useCallback(
    async (updatedTags: TagLabel[]) => {
      try {
        const allTags = prepareClassificationTags(updatedTags);
        const response = await performColumnFieldUpdate(
          { tags: allTags },
          'label.tag-plural'
        );

        if (response) {
          setActiveColumn((prev) => ({ ...prev, tags: response.tags } as T));
        }

        return response?.tags;
      } catch (error) {
        setLocalToast({
          open: true,
          message:
            getErrorText(error as AxiosError, t('message.error')) ||
            t('server.entity-updating-error', {
              entity: t('label.tag-plural'),
            }),
          type: 'error',
        });

        throw error;
      }
    },
    [prepareClassificationTags, performColumnFieldUpdate, t]
  );

  const handleGlossaryTermsUpdate = useCallback(
    async (updatedTags: TagLabel[]) => {
      try {
        // Merge glossary terms with existing classification tags
        const classificationAndTierTags = (activeColumn?.tags ?? []).filter(
          (tag) =>
            tag.source === TagSource.Classification ||
            (tag.tagFQN?.startsWith('Tier.') ?? false)
        );
        const allTags = normalizeTags([
          ...classificationAndTierTags,
          ...updatedTags.filter((tag) => tag.source === TagSource.Glossary),
        ]);

        const response = await performColumnFieldUpdate(
          { tags: allTags },
          'label.glossary-term-plural'
        );

        if (response) {
          setActiveColumn((prev) => ({ ...prev, tags: response.tags } as T));
        }

        return response?.tags;
      } catch (error) {
        setLocalToast({
          open: true,
          message:
            getErrorText(error as AxiosError, t('message.error')) ||
            t('server.entity-updating-error', {
              entity: t('label.glossary-term-plural'),
            }),
          type: 'error',
        });

        throw error;
      }
    },
    [activeColumn?.tags, performColumnFieldUpdate, t]
  );

  const handleExtensionUpdate = useCallback(
    async (updatedExtension: Record<string, unknown> | undefined) => {
      try {
        await performColumnFieldUpdate(
          { extension: updatedExtension },
          'label.custom-property-plural'
        );
      } catch (error) {
        setLocalToast({
          open: true,
          message:
            getErrorText(error as AxiosError, t('message.error')) ||
            t('server.entity-updating-error', {
              entity: t('label.custom-property-plural'),
            }),
          type: 'error',
        });
      }
    },
    [performColumnFieldUpdate, t]
  );

  const handleDisplayNameUpdate = useCallback(
    async (data: EntityName) => {
      try {
        const response = await performColumnFieldUpdate(
          { displayName: data.displayName },
          'label.display-name'
        );
        if (response) {
          setActiveColumn(
            (prev) =>
              ({
                ...prev,
                displayName: response.displayName,
              } as T)
          );
        }
      } catch (error) {
        setLocalToast({
          open: true,
          message:
            getErrorText(error as AxiosError, t('message.error')) ||
            t('server.entity-updating-error', {
              entity: t('label.display-name'),
            }),
          type: 'error',
        });
      } finally {
        setIsDisplayNameEditing(false);
      }
    },
    [performColumnFieldUpdate, t]
  );

  const previousFqnRef = useRef<string | undefined>();

  useEffect(() => {
    // Only reset if FQN effectively changed or panel was just opened
    if (isOpen && activeColumn) {
      if (activeColumn.fullyQualifiedName !== previousFqnRef.current) {
        setActiveTab(EntityRightPanelTab.OVERVIEW);
        previousFqnRef.current = activeColumn.fullyQualifiedName;
      }
    } else if (!isOpen) {
      // Reset ref when panel closes so next open resets tab
      previousFqnRef.current = undefined;
    }
  }, [isOpen, activeColumn?.fullyQualifiedName]);

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

  const isPreviousDisabled = !isColumnInList || actualColumnIndex === 0;
  const isNextDisabled =
    !isColumnInList || actualColumnIndex === flattenedColumns.length - 1;

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
      activeColumn?.tags?.filter((tag) => tag.source !== TagSource.Glossary) ||
      [],
    [activeColumn?.tags]
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
            description={activeColumn?.description}
            entityFqn={activeColumn?.fullyQualifiedName}
            entityType={entityType}
            hasPermission={hasEditPermission?.description ?? false}
            onDescriptionUpdate={handleDescriptionUpdate}
          />
        )}

        {isColumn(activeColumn ?? null) && entityType === EntityType.TABLE && (
          <KeyProfileMetrics
            columnFqn={activeColumn!.fullyQualifiedName}
            tableFqn={tableFqn}
          />
        )}

        {isColumn(activeColumn ?? null) && (
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
          entityId={activeColumn?.fullyQualifiedName || ''}
          entityType={'_column' as EntityType}
          hasPermission={hasEditPermission?.glossaryTerms ?? false}
          maxVisibleGlossaryTerms={3}
          tags={activeColumn?.tags}
          onGlossaryTermsUpdate={handleGlossaryTermsUpdate}
        />

        <TagsSection
          entityId={activeColumn?.fullyQualifiedName || ''}
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
        entityFqn={activeColumn?.fullyQualifiedName || ''}
        filter={lineageFilter}
        lineageData={lineageData}
        onFilterChange={setLineageFilter}
      />
    );
  };

  const renderCustomPropertiesTab = () => {
    if (!activeColumn?.fullyQualifiedName) {
      return null;
    }

    return (
      <div className="overview-tab-content">
        <CustomPropertiesSection
          entityData={toEntityData(activeColumn)}
          entityType={entityType}
          entityTypeDetail={entityTypeDetail}
          hasEditPermissions={hasEditPermission.customProperties}
          isEntityDataLoading={false}
          viewCustomPropertiesPermission={
            hasViewPermission?.customProperties ?? false
          }
          onExtensionUpdate={handleExtensionUpdate}
        />
      </div>
    );
  };
  const isPrimaryKey = useMemo(() => {
    const columnName = activeColumn?.name;
    if (!columnName) {
      return false;
    }

    return tableConstraints.some(
      (constraint: TableConstraint) =>
        constraint.constraintType === 'PRIMARY_KEY' &&
        constraint.columns?.includes(columnName)
    );
  }, [activeColumn?.name, tableConstraints]);

  const columnTitle = activeColumn ? (
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
                  style={{
                    fontSize: 12,
                    color: theme.palette.allShades?.gray?.[500],
                    fontWeight: 400,
                  }}>
                  {getEntityName(breadcrumb)}
                </Typography.Text>
                {index < breadcrumbPath.length - 1 && (
                  <ChevronRight
                    color={theme.palette.allShades?.gray?.[400]}
                    height={16}
                    width={16}
                  />
                )}
              </Box>
            ))}
          </Box>
        )}
        <Tooltip
          mouseEnterDelay={0.5}
          placement="topLeft"
          title={getEntityName(activeColumn)}
          trigger="hover">
          <div className="d-flex items-center justify-between w-full">
            <div className="d-flex items-center w-full">
              <span className="entity-icon margin-right-xs">
                <ColumnIcon />
              </span>
              <div className="d-flex flex-column w-full overflow-hidden">
                <div className="d-flex items-center gap-2 w-full">
                  <Typography.Text
                    className="entity-title-link"
                    data-testid="entity-link"
                    ellipsis={{ tooltip: true }}>
                    {stringToHTML(
                      (activeColumn as any).displayName || activeColumn.name
                    )}
                  </Typography.Text>
                  {hasEditPermission.displayName &&
                    (entityType === EntityType.TABLE ||
                      entityType === EntityType.DASHBOARD_DATA_MODEL) && (
                      <Tooltip placement="top" title={t('label.edit')}>
                        <Button
                          ghost
                          className="hover-cell-icon flex-center"
                          data-testid="edit-displayName-button"
                          icon={
                            <IconEdit
                              color={DE_ACTIVE_COLOR}
                              {...ICON_DIMENSION}
                            />
                          }
                          style={{
                            width: '24px',
                            height: '24px',
                          }}
                          type="text"
                          onClick={() => setIsDisplayNameEditing(true)}
                        />
                      </Tooltip>
                    )}
                </div>
                {(activeColumn as any).displayName &&
                  (activeColumn as any).displayName !== activeColumn.name &&
                  (entityType === EntityType.TABLE ||
                    entityType === EntityType.DASHBOARD_DATA_MODEL) && (
                    <Typography.Text
                      className="text-grey-muted text-xs"
                      data-testid="entity-name"
                      ellipsis={{ tooltip: true }}>
                      {stringToHTML(activeColumn.name || '')}
                    </Typography.Text>
                  )}
              </div>
            </div>
            <div>
              <IconButton data-testid="close-button" onClick={onClose}>
                <XClose
                  color={theme.palette.allShades?.gray?.[600]}
                  height={16}
                  width={16}
                />
              </IconButton>
            </div>
          </div>
        </Tooltip>
        <div className="d-flex items-center gap-2">
          {isColumn(activeColumn) && getDataTypeDisplay(activeColumn) && (
            <Tooltip
              placement="bottom"
              title={getDataTypeDisplay(activeColumn)}
              trigger="hover">
              <Chip
                className="data-type-chip"
                label={getDataTypeDisplay(activeColumn) || ''}
                size="small"
                sx={{
                  maxWidth: '240px',
                  '& .MuiChip-label': {
                    display: 'block',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
                variant="outlined"
              />
            </Tooltip>
          )}
          {isColumn(activeColumn) && isPrimaryKey && (
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
    if (!activeColumn) {
      return null;
    }

    switch (activeTab) {
      case EntityRightPanelTab.DATA_QUALITY:
        return (
          <DataQualityTab
            isColumnDetailPanel
            entityFQN={activeColumn.fullyQualifiedName || ''}
            entityType={entityType}
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

  if (!activeColumn) {
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
            {isColumnInList && flattenedColumns.length > 0 && (
              <Typography.Text className="pagination-header-text text-medium">
                {actualColumnIndex + 1} {t('label.of-lowercase')}{' '}
                {flattenedColumns.length}{' '}
                {t('label.column-plural').toLowerCase()}
              </Typography.Text>
            )}
          </div>
        </div>
      }
      open={isOpen}
      placement="right"
      title={columnTitle}
      width="40%"
      onClose={onClose}>
      {localToast.open && (
        <Box
          sx={{
            position: 'sticky',
            top: -20,
            zIndex: 1,
            margin: '0px 16px 16px 8px',
            '& .ant-alert': {
              minHeight: 48,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',

              '& .ant-alert-icon': {
                display: 'flex',
                alignItems: 'center',
                marginRight: 1,
              },

              '& #alert-icon': {
                padding: 0.5,
                borderWidth: 3,
                fontSize: 16,
              },

              '& .ant-alert-description': {
                flex: 1,
                wordBreak: 'break-word',
              },
            },
          }}>
          <AlertBar
            defaultExpand
            message={localToast.message}
            type={localToast.type}
          />
        </Box>
      )}
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
      {isDisplayNameEditing && activeColumn && (
        <EntityNameModal
          entity={{
            name: isString(activeColumn.name) ? activeColumn.name : '',
            displayName: isString((activeColumn as any).displayName)
              ? (activeColumn as any).displayName
              : undefined,
          }}
          title={t('label.edit-entity', {
            entity: t('label.display-name'),
          })}
          visible={isDisplayNameEditing}
          onCancel={() => setIsDisplayNameEditing(false)}
          onSave={handleDisplayNameUpdate}
        />
      )}
    </Drawer>
  );
};
