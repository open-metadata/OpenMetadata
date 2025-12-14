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
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowSvg } from '../../../assets/svg/down-arrow-icon.svg';
import { ReactComponent as ColumnIcon } from '../../../assets/svg/ic-column-new.svg';
import { ReactComponent as KeyIcon } from '../../../assets/svg/icon-key.svg';
import { ReactComponent as ArrowUp } from '../../../assets/svg/up-arrow-icon.svg';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { Column, TableConstraint } from '../../../generated/entity/data/table';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { TagSource } from '../../../generated/type/tagLabel';
import { updateTableColumn } from '../../../rest/tableAPI';
import { listTestCases } from '../../../rest/testAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import { generateEntityLink } from '../../../utils/TableUtils';
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
  TestCaseStatusCounts,
} from './ColumnDetailPanel.interface';
import './ColumnDetailPanel.less';

export const ColumnDetailPanel = ({
  column,
  isOpen,
  onClose,
  onColumnUpdate,
  hasEditPermission = {},
  allColumns = [],
  currentColumnIndex = 0,
  onNavigate,
  tableConstraints = [],
}: ColumnDetailPanelProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
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

      const counts = (response.data || []).reduce(
        (acc, testCase) => {
          const status = testCase.testCaseResult?.testCaseStatus;
          if (status) {
            switch (status) {
              case TestCaseStatus.Success:
                acc.success++;

                break;
              case TestCaseStatus.Failed:
                acc.failed++;

                break;
              case TestCaseStatus.Aborted:
                acc.aborted++;

                break;
            }
            acc.total++;
          }

          return acc;
        },
        { success: 0, failed: 0, aborted: 0, total: 0 }
      );

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

  const handleDescriptionUpdate = useCallback(
    async (newDescription: string) => {
      if (!column?.fullyQualifiedName) {
        return;
      }

      try {
        setIsLoading(true);
        const response = await updateTableColumn(column.fullyQualifiedName, {
          description: newDescription,
        });

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.description'),
          })
        );

        if (onColumnUpdate) {
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
        setIsLoading(false);
      }
    },
    [column, t, onColumnUpdate]
  );

  const handleTagsUpdate = useCallback(
    async (updatedTags: Column['tags']) => {
      if (!column?.fullyQualifiedName) {
        return;
      }

      try {
        setIsLoading(true);
        const response = await updateTableColumn(column.fullyQualifiedName, {
          tags: updatedTags,
        });

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
      } finally {
        setIsLoading(false);
      }
    },
    [column, t, onColumnUpdate]
  );

  const handleGlossaryTermsUpdate = useCallback(
    async (updatedGlossaryTerms: Column['tags']) => {
      if (!column?.fullyQualifiedName) {
        return;
      }

      try {
        setIsLoading(true);
        const nonGlossaryTags =
          column.tags?.filter((tag) => tag.source !== TagSource.Glossary) || [];
        const allTags = [...nonGlossaryTags, ...(updatedGlossaryTerms || [])];

        const response = await updateTableColumn(column.fullyQualifiedName, {
          tags: allTags,
        });

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
      } finally {
        setIsLoading(false);
      }
    },
    [column, t, onColumnUpdate]
  );

  useEffect(() => {
    if (isOpen && column) {
      setActiveTab(EntityRightPanelTab.OVERVIEW);
    }
  }, [isOpen, column]);

  const handleTabChange = (tab: EntityRightPanelTab) => {
    setActiveTab(tab);
  };

  const handlePreviousColumn = () => {
    if (currentColumnIndex > 0 && onNavigate) {
      const prevColumn = allColumns[currentColumnIndex - 1];
      onNavigate(prevColumn, currentColumnIndex - 1);
    }
  };

  const handleNextColumn = () => {
    if (currentColumnIndex < allColumns.length - 1 && onNavigate) {
      const nextColumn = allColumns[currentColumnIndex + 1];
      onNavigate(nextColumn, currentColumnIndex + 1);
    }
  };

  const isPreviousDisabled = currentColumnIndex === 0;
  const isNextDisabled = currentColumnIndex === allColumns.length - 1;

  const renderOverviewTab = () => {
    if (isLoading) {
      return (
        <div className="flex-center p-lg">
          <Loader size="default" />
        </div>
      );
    }

    return (
      <Space className="w-full" direction="vertical" size="large">
        <DescriptionSection
          description={column?.description}
          hasPermission={hasEditPermission.description}
          onDescriptionUpdate={handleDescriptionUpdate}
        />

        {isTestCaseLoading ? (
          <Loader size="small" />
        ) : (
          statusCounts.total > 0 && (
            <DataQualitySection
              tests={[
                { type: 'success', count: statusCounts.success },
                { type: 'aborted', count: statusCounts.aborted },
                { type: 'failed', count: statusCounts.failed },
              ]}
              totalTests={statusCounts.total}
              onEdit={() => {
                // Handle edit functionality
              }}
            />
          )
        )}

        <GlossaryTermsSection
          entityId={column?.fullyQualifiedName || ''}
          entityType={'_column' as EntityType}
          hasPermission={hasEditPermission.glossaryTerms}
          maxVisibleGlossaryTerms={3}
          tags={column?.tags}
          onGlossaryTermsUpdate={handleGlossaryTermsUpdate}
        />

        <TagsSection
          entityId={column?.fullyQualifiedName || ''}
          entityType={'_column' as EntityType}
          hasPermission={hasEditPermission.tags}
          tags={
            column?.tags?.filter((tag) => tag.source !== TagSource.Glossary) ||
            []
          }
          onTagsUpdate={handleTagsUpdate}
        />
      </Space>
    );
  };
  const [lineageData] = useState<LineageData | null>(null);
  const [isLineageLoading] = useState<boolean>(false);
  const [lineageFilter, setLineageFilter] = useState<'upstream' | 'downstream'>(
    'downstream'
  );

  const renderLineageTab = () => {
    if (isLineageLoading) {
      return (
        <div className="flex-center p-lg">
          <Loader size="default" />
        </div>
      );
    }

    if (lineageData) {
      return (
        <LineageTabContent
          entityFqn={column?.fullyQualifiedName || ''}
          filter={lineageFilter}
          lineageData={lineageData}
          onFilterChange={setLineageFilter}
        />
      );
    }

    return (
      <div className="text-center text-grey-muted p-lg">
        {t('label.no-data-found')}
      </div>
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
          entityType={EntityType.TABLE}
          isEntityDataLoading={isLoading}
          viewCustomPropertiesPermission={
            hasEditPermission.customProperties ?? false
          }
        />
      </div>
    );
  };
  const isPrimaryKey = tableConstraints.some(
    (constraint: TableConstraint) =>
      constraint.constraintType === 'PRIMARY_KEY' &&
      constraint.columns?.includes(column?.name ?? '')
  );

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
                icon={<CloseOutlined />}
                size="small"
                type="text"
                onClick={onClose}
              />
            </div>
          </div>
        </Tooltip>
        <div className="d-flex items-center gap-2">
          <Chip
            className="data-type-chip"
            label={column.dataTypeDisplay}
            size="small"
            variant="outlined"
          />
          {isPrimaryKey && (
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
            entityType={EntityType.TABLE as string}
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
              {currentColumnIndex + 1} {t('label.of-lowercase')}{' '}
              {allColumns.length} {t('label.column-plural').toLowerCase()}
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
