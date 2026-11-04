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
import { isEqual, isUndefined } from 'lodash';
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
import { NODE_INSET_FILL_CLASS } from '../CustomNode.constants';
import { NodeChildrenProps } from './NodeChildren.interface';
import VirtualColumnList from './VirtualColumnList.component';

const NodeChildren = ({
  node,
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

  const filteredColumns = useMemo(() => {
    const columnsToSearch = isOnlyShowColumnsWithLineageFilterActive
      ? stableColumnsWithLineage
      : entityChildren;
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return columnsToSearch;
    }
    const findMatches = (columns: EntityChildren) =>
      columns.filter((column) =>
        getEntityName(column).toLowerCase().includes(query)
      );
    const matches = findMatches(columnsToSearch);

    // With the lineage filter on, a column without lineage would be
    // unfindable, so fall back to searching every column of the node.
    return matches.length === 0 && isOnlyShowColumnsWithLineageFilterActive
      ? findMatches(entityChildren)
      : matches;
  }, [
    entityChildren,
    searchValue,
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
          NODE_INSET_FILL_CLASS,
          selectedColumn && 'any-column-selected',
          isCreatingEdge && 'creating-edge'
        )}
        data-testid="column-container">
        <div className="search-box">
          <Input
            aria-label={t('label.search-entity', {
              entity: childrenHeading,
            })}
            icon={Search}
            inputDataTestId="search-column-input"
            placeholder={t('label.search-entity', {
              entity: childrenHeading,
            })}
            value={searchValue}
            onChange={setSearchValue}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          />

          <section className="m-t-md" id="table-columns">
            <div className="rounded-4 overflow-hidden">
              <VirtualColumnList
                flatItems={filteredColumns}
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
