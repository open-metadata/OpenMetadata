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
import { SearchOutlined } from '@ant-design/icons';
import { Collapse, Input } from 'antd';
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
import { getColumnContent } from '../CustomNode.utils';
import { EntityChildren, NodeChildrenProps } from './NodeChildren.interface';

const NodeChildren = ({
  node,
  isConnectable,
  isColumnsListExpanded,
}: NodeChildrenProps) => {
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
  const [summary, setSummary] = useState<TestSummary>();
  const [isLoading, setIsLoading] = useState(true);

  const { isColumnLayerEnabled, showDataObservability } = useMemo(() => {
    return {
      isColumnLayerEnabled: activeLayer.includes(
        LineageLayer.ColumnLevelLineage
      ),
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
        setShowAllColumns(false);
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

  const isColumnVisible = useCallback(
    (record: Column) => {
      if (
        expandAllColumns ||
        isEditMode ||
        showAllColumns ||
        isColumnsListExpanded
      ) {
        return true;
      }

      return columnsHavingLineage.includes(record.fullyQualifiedName ?? '');
    },
    [
      isEditMode,
      columnsHavingLineage,
      expandAllColumns,
      showAllColumns,
      isColumnsListExpanded,
    ]
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

  if (
    supportsColumns &&
    (isColumnLayerEnabled || showDataObservability || isColumnsListExpanded)
  ) {
    return (
      (isColumnLayerEnabled || isColumnsListExpanded) && (
        <div className="column-container">
          <div className="search-box">
            <Input
              placeholder={t('label.search-entity', {
                entity: childrenHeading,
              })}
              suffix={<SearchOutlined color={BORDER_COLOR} />}
              value={searchValue}
              onChange={handleSearchChange}
              onClick={(e) => e.stopPropagation()}
            />

            {isColumnsListExpanded && !isEmpty(renderedColumns) && (
              <section className="m-t-md" id="table-columns">
                <div className="rounded-4 overflow-hidden">
                  {renderedColumns}
                </div>
              </section>
            )}
          </div>
        </div>
      )
    );
  } else {
    return null;
  }
};

export default NodeChildren;
