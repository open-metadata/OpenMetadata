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
import { DownOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Collapse, Input, Space } from 'antd';
import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BORDER_COLOR } from '../../../../constants/constants';
import {
  DATATYPES_HAVING_SUBFIELDS,
  LINEAGE_COLUMN_NODE_SUPPORTED,
} from '../../../../constants/Lineage.constants';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../../../enums/entity.enum';
import { Column, Table } from '../../../../generated/entity/data/table';
import { LineageLayer } from '../../../../generated/settings/settings';
import {
  EntityReference,
  TestSummary,
} from '../../../../generated/tests/testCase';
import { getTestCaseExecutionSummary } from '../../../../rest/testAPI';
import { getEntityChildrenAndLabel } from '../../../../utils/EntityLineageUtils';
import EntityLink from '../../../../utils/EntityLink';
import { getEntityName } from '../../../../utils/EntityUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import { getColumnContent } from '../CustomNode.utils';
import TestSuiteSummaryWidget from '../TestSuiteSummaryWidget/TestSuiteSummaryWidget.component';
import { EntityChildren, NodeChildrenProps } from './NodeChildren.interface';

const NodeChildren = ({ node, isConnectable }: NodeChildrenProps) => {
  const { t } = useTranslation();
  const { Panel } = Collapse;
  const {
    tracedColumns,
    activeLayer,
    onColumnClick,
    columnsHavingLineage,
    isEditMode,
    expandAllColumns,
  } = useLineageProvider();
  const { entityType } = node;
  const [searchValue, setSearchValue] = useState('');
  const [filteredColumns, setFilteredColumns] = useState<EntityChildren>([]);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [summary, setSummary] = useState<TestSummary>();
  const [isLoading, setIsLoading] = useState(true);

  const { showColumns, showDataObservability } = useMemo(() => {
    return {
      showColumns: activeLayer.includes(LineageLayer.ColumnLevelLineage),
      showDataObservability: activeLayer.includes(
        LineageLayer.DataObservability
      ),
    };
  }, [activeLayer]);

  const getColumnSummary = useCallback(
    (column: Column) => {
      const { fullyQualifiedName } = column;

      return summary?.columnTestSummary?.find(
        (data) =>
          EntityLink.getEntityColumnFqn(data.entityLink ?? '') ===
          fullyQualifiedName
      );
    },
    [summary]
  );

  const showDataObservabilitySummary = useMemo(() => {
    return Boolean(
      showDataObservability &&
        entityType === EntityType.TABLE &&
        (node as Table).testSuite
    );
  }, [node, showDataObservability, entityType]);

  const supportsColumns = useMemo(() => {
    return (
      node &&
      LINEAGE_COLUMN_NODE_SUPPORTED.includes(node.entityType as EntityType)
    );
  }, [node.id]);

  const { children, childrenHeading } = useMemo(
    () => getEntityChildrenAndLabel(node),
    [node.id]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      const value = e.target.value;
      setSearchValue(value);

      if (value.trim() === '') {
        // If search value is empty, show all columns
        const filterColumns = Object.values(children ?? {});
        setFilteredColumns(filterColumns);
      } else {
        // Filter columns based on search value
        const filtered = Object.values(children ?? {}).filter((column) =>
          getEntityName(column).toLowerCase().includes(value.toLowerCase())
        );
        setFilteredColumns(filtered);
        setShowAllColumns(true);
      }
    },
    [children]
  );

  const handleShowMoreClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setShowAllColumns(true);
  };

  const isColumnVisible = useCallback(
    (record: Column) => {
      if (expandAllColumns || isEditMode || showAllColumns) {
        return true;
      }

      return columnsHavingLineage.includes(record.fullyQualifiedName ?? '');
    },
    [isEditMode, columnsHavingLineage, expandAllColumns, showAllColumns]
  );

  useEffect(() => {
    if (!isEmpty(children)) {
      setFilteredColumns(children);
    }
  }, [children]);

  useEffect(() => {
    setShowAllColumns(expandAllColumns);
  }, [expandAllColumns]);

  const fetchTestSuiteSummary = async (testSuite: EntityReference) => {
    setIsLoading(true);
    try {
      const response = await getTestCaseExecutionSummary(testSuite.id);
      setSummary(response);
    } catch {
      setSummary(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const testSuite = (node as Table)?.testSuite;
    if (showDataObservabilitySummary && testSuite && isUndefined(summary)) {
      fetchTestSuiteSummary(testSuite);
    } else {
      setIsLoading(false);
    }
  }, [node, showDataObservabilitySummary, summary]);

  const renderRecord = useCallback(
    (record: Column) => {
      const isColumnTraced = tracedColumns.includes(
        record.fullyQualifiedName ?? ''
      );

      const columnSummary = getColumnSummary(record);

      const headerContent = getColumnContent(
        record,
        isColumnTraced,
        isConnectable,
        onColumnClick,
        showDataObservabilitySummary,
        isLoading,
        columnSummary
      );

      if (!record.children || record.children.length === 0) {
        if (!isColumnVisible(record)) {
          return null;
        }

        return headerContent;
      }

      const childRecords = record?.children?.map((child) => {
        const { fullyQualifiedName, dataType } = child;

        const columnSummary = getColumnSummary(child);

        if (DATATYPES_HAVING_SUBFIELDS.includes(dataType)) {
          return renderRecord(child);
        } else {
          const isColumnTraced = tracedColumns.includes(
            fullyQualifiedName ?? ''
          );

          if (!isColumnVisible(child)) {
            return null;
          }

          return getColumnContent(
            child,
            isColumnTraced,
            isConnectable,
            onColumnClick,
            showDataObservabilitySummary,
            isLoading,
            columnSummary
          );
        }
      });

      const result = childRecords.filter((child) => child !== null);

      if (result.length === 0) {
        return null;
      }

      return (
        <Collapse
          destroyInactivePanel
          className="lineage-collapse-column"
          defaultActiveKey={record.fullyQualifiedName}
          expandIcon={() => null}
          key={record.fullyQualifiedName}>
          <Panel header={headerContent} key={record.fullyQualifiedName ?? ''}>
            {result}
          </Panel>
        </Collapse>
      );
    },
    [
      isConnectable,
      tracedColumns,
      onColumnClick,
      isColumnVisible,
      showDataObservabilitySummary,
      isLoading,
      summary,
    ]
  );
  const renderColumnsData = useCallback(
    (column: Column) => {
      const { fullyQualifiedName, dataType } = column;
      const columnSummary = getColumnSummary(column);

      if (DATATYPES_HAVING_SUBFIELDS.includes(dataType)) {
        return renderRecord(column);
      } else {
        const isColumnTraced = tracedColumns.includes(fullyQualifiedName ?? '');
        if (!isColumnVisible(column)) {
          return null;
        }

        return getColumnContent(
          column,
          isColumnTraced,
          isConnectable,
          onColumnClick,
          showDataObservabilitySummary,
          isLoading,
          columnSummary
        );
      }
    },
    [
      isConnectable,
      tracedColumns,
      isColumnVisible,
      showDataObservabilitySummary,
      isLoading,
      summary,
    ]
  );

  // Pre-render column data outside of the return statement
  const renderedColumns = useMemo(() => {
    return filteredColumns
      .map((column) => renderColumnsData(column as Column))
      .filter(Boolean);
  }, [filteredColumns, renderColumnsData]);

  // Memoize the expand/collapse icon to prevent unnecessary re-renders
  const expandCollapseIcon = useMemo(() => {
    return isExpanded ? (
      <UpOutlined style={{ fontSize: '12px' }} />
    ) : (
      <DownOutlined style={{ fontSize: '12px' }} />
    );
  }, [isExpanded]);

  // Memoize the entity icon to prevent unnecessary re-renders
  const entityIcon = useMemo(() => {
    return searchClassBase.getEntityIcon(node.entityType ?? '');
  }, [node.entityType]);

  const shouldShowMoreButton = useMemo(() => {
    return (
      !showAllColumns &&
      !isEmpty(children) &&
      renderedColumns.length !== children.length &&
      !searchValue
    );
  }, [showAllColumns, children, renderedColumns, searchValue]);

  // Memoize the expand/collapse click handler
  const handleExpandCollapseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prevIsExpanded: boolean) => !prevIsExpanded);
  }, []);

  if (supportsColumns && (showColumns || showDataObservability)) {
    return (
      <div className="column-container">
        <div className="d-flex justify-between items-center">
          <div>
            {showColumns && (
              <Button
                className="flex-center text-primary rounded-4 p-xss h-9"
                data-testid="expand-cols-btn"
                type="text"
                onClick={handleExpandCollapseClick}>
                <Space>
                  <div className=" w-5 h-5 text-base-color">{entityIcon}</div>
                  {childrenHeading}
                  {expandCollapseIcon}
                </Space>
              </Button>
            )}
          </div>
          {showDataObservabilitySummary && (
            <TestSuiteSummaryWidget isLoading={isLoading} summary={summary} />
          )}
        </div>

        {showColumns && isExpanded && (
          <div className="m-t-md">
            <div className="search-box">
              <Input
                placeholder={t('label.search-entity', {
                  entity: childrenHeading,
                })}
                suffix={<SearchOutlined color={BORDER_COLOR} />}
                value={searchValue}
                onChange={handleSearchChange}
              />
            </div>

            {!isEmpty(renderedColumns) && (
              <section className="m-t-md" id="table-columns">
                <div
                  className={classNames('rounded-4 overflow-hidden', {
                    border: !showAllColumns,
                  })}>
                  {renderedColumns}
                </div>
              </section>
            )}

            {shouldShowMoreButton && (
              <Button
                className="m-t-xs text-primary"
                data-testid="show-more-columns-btn"
                type="text"
                onClick={handleShowMoreClick}>
                {t('label.show-more-entity', {
                  entity: t('label.column-plural'),
                })}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  } else {
    return null;
  }
};

export default NodeChildren;
