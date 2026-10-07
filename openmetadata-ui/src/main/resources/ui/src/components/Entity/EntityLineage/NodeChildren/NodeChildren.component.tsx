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
import { Input } from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty, isEqual, isUndefined } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  LINEAGE_CHILD_ITEMS_PER_PAGE,
  LINEAGE_COLUMN_NODE_SUPPORTED,
} from '../../../../constants/Lineage.constants';
import { EntityType } from '../../../../enums/entity.enum';
import {
  EntityReference,
  TestSummary,
} from '../../../../generated/tests/testCase';
import { useLineageStore } from '../../../../hooks/useLineageStore';
import { EntityChildren } from '../../../../interface/lineage.interface';
import { getTestCaseExecutionSummary } from '../../../../rest/testAPI';
import { getEntityChildrenAndLabel } from '../../../../utils/EntityLineageNodeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { NodeChildrenProps } from './NodeChildren.interface';
import VirtualColumnList from './VirtualColumnList.component';

const NodeChildren = ({
  node,
  isConnectable,
  isChildrenListExpanded,
  isOnlyShowColumnsWithLineageFilterActive,
  onColumnHover,
  onColumnSelect,
  onColumnLineageEdit,
}: NodeChildrenProps) => {
  const { t } = useTranslation();
  const {
    isColumnLevelLineage,
    isDQEnabled,
    columnsHavingLineage,
    selectedColumn,
    isCreatingEdge,
  } = useLineageStore();
  const { entityType } = node;
  const [searchValue, setSearchValue] = useState('');
  const [filteredColumns, setFilteredColumns] = useState<EntityChildren>([]);
  const [summary, setSummary] = useState<TestSummary>();
  const [isLoading, setIsLoading] = useState(true);

  const showDataObservabilitySummary = useMemo(() => {
    return Boolean(
      isDQEnabled && entityType === EntityType.TABLE && node.testSuite
    );
  }, [isDQEnabled, entityType, node.testSuite]);

  const supportsColumns = useMemo(() => {
    return (
      node &&
      LINEAGE_COLUMN_NODE_SUPPORTED.includes(node.entityType as EntityType)
    );
  }, [node]);

  const { children: entityChildren, childrenHeading } = useMemo(
    () => getEntityChildrenAndLabel(node),
    [node]
  );

  const currentNodeColumnsWithLineage = useMemo(() => {
    const filtered = entityChildren.filter((column) =>
      columnsHavingLineage.get(node.id)?.has(column.fullyQualifiedName ?? '')
    );

    return filtered;
  }, [entityChildren, columnsHavingLineage, node.id]);

  const prevFilteredRef = useRef<EntityChildren>([]);
  const stableColumnsWithLineage = useMemo(() => {
    if (isEqual(prevFilteredRef.current, currentNodeColumnsWithLineage)) {
      return prevFilteredRef.current;
    }
    prevFilteredRef.current = currentNodeColumnsWithLineage;

    return currentNodeColumnsWithLineage;
  }, [currentNodeColumnsWithLineage]);

  const handleSearchChange = useCallback(
    (searchQuery: string) => {
      setSearchValue(searchQuery);
      const currentNodeColumnsToSearch =
        isOnlyShowColumnsWithLineageFilterActive
          ? stableColumnsWithLineage
          : entityChildren;

      if (searchQuery.trim() === '') {
        setFilteredColumns(currentNodeColumnsToSearch);
      } else {
        const currentNodeMatchedColumns = currentNodeColumnsToSearch.filter(
          (column) =>
            getEntityName(column)
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
        );
        setFilteredColumns(currentNodeMatchedColumns);
      }
    },
    [
      entityChildren,
      stableColumnsWithLineage,
      isOnlyShowColumnsWithLineageFilterActive,
    ]
  );

  useEffect(() => {
    if (!isEmpty(entityChildren)) {
      if (isOnlyShowColumnsWithLineageFilterActive) {
        setFilteredColumns(stableColumnsWithLineage);
      } else {
        setFilteredColumns(entityChildren);
      }
    }
  }, [
    entityChildren,
    stableColumnsWithLineage,
    isOnlyShowColumnsWithLineageFilterActive,
  ]);

  const fetchTestSuiteSummary = useCallback(
    async (testSuite: EntityReference) => {
      setIsLoading(true);
      try {
        const response = await getTestCaseExecutionSummary(testSuite.id);
        setSummary(response);
      } catch {
        setSummary(undefined);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const testSuite = node?.testSuite;
    if (showDataObservabilitySummary && testSuite && isUndefined(summary)) {
      fetchTestSuiteSummary(testSuite);
    } else {
      setIsLoading(false);
    }
  }, [fetchTestSuiteSummary, node, showDataObservabilitySummary, summary]);

  const pageSize = useMemo(() => {
    return isOnlyShowColumnsWithLineageFilterActive
      ? filteredColumns.length
      : LINEAGE_CHILD_ITEMS_PER_PAGE;
  }, [isOnlyShowColumnsWithLineageFilterActive, filteredColumns.length]);

  // No need to render if there's no children
  if (entityChildren.length === 0) {
    return null;
  }

  if (
    supportsColumns &&
    (isColumnLevelLineage || isDQEnabled || isChildrenListExpanded)
  ) {
    return (
      <div
        className={classNames(
          'column-container',
          selectedColumn && 'any-column-selected',
          isCreatingEdge && 'creating-edge'
        )}
        data-testid="column-container">
        <div className="search-box">
          <Input
            icon={Search}
            inputDataTestId="search-column-input"
            placeholder={t('label.search-entity', {
              entity: childrenHeading,
            })}
            value={searchValue}
            onChange={handleSearchChange}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          />

          <section className="m-t-md" id="table-columns">
            <div className="rounded-4 overflow-hidden">
              <VirtualColumnList
                flatItems={filteredColumns}
                isConnectable={isConnectable}
                isLoading={isLoading}
                nodeId={node.id}
                pageSize={pageSize}
                showDataObservabilitySummary={showDataObservabilitySummary}
                summary={summary}
                onColumnHover={onColumnHover}
                onColumnLineageEdit={onColumnLineageEdit}
                onColumnSelect={onColumnSelect}
              />
            </div>
          </section>
        </div>
      </div>
    );
  } else {
    return null;
  }
};

export default NodeChildren;
