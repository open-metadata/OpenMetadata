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

import { Table } from '@openmetadata/ui-core-components';
import { useCallback, useMemo } from 'react';
import { Selection } from 'react-aria-components';
import Loader from '../Loader/Loader';
import { EntityListingTableProps } from './EntityListingTable.interface';

const EntityListingTable = <T extends { id: string; name: string }>({
  entities,
  loading,
  columns,
  renderCell,
  selectedEntities,
  onSelectAll,
  onSelect,
  onEntityClick,
  ariaLabel,
  emptyMessage,
}: EntityListingTableProps<T>) => {
  const selectedKeys: Selection = useMemo(
    () => new Set(selectedEntities),
    [selectedEntities]
  );

  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      if (keys === 'all') {
        onSelectAll(true);
      } else if ((keys as Set<string>).size === 0) {
        onSelectAll(false);
      } else {
        const newKeys = new Set(keys as Set<string>);
        const prevKeys = new Set(selectedEntities);
        for (const key of newKeys) {
          if (!prevKeys.has(key as string)) {
            onSelect(key as string, true);
          }
        }
        for (const key of prevKeys) {
          if (!newKeys.has(key)) {
            onSelect(key, false);
          }
        }
      }
    },
    [onSelectAll, onSelect, selectedEntities]
  );

  if (loading) {
    return <Loader />;
  }

  return (
    <Table
      aria-label={ariaLabel}
      data-testid="table-view-container"
      selectedKeys={selectedKeys}
      selectionBehavior="toggle"
      selectionMode="multiple"
      onSelectionChange={handleSelectionChange}>
      <Table.Header
        className="tw:border-t tw:border-x tw:border-secondary"
        columns={columns}>
        {(col) => <Table.Head id={col.id} key={col.id} label={col.label} />}
      </Table.Header>
      <Table.Body
        items={entities}
        renderEmptyState={() =>
          emptyMessage ? (
            <div className="tw:py-12 tw:text-center tw:text-sm tw:text-tertiary">
              {emptyMessage}
            </div>
          ) : null
        }>
        {(entity) => (
          <Table.Row
            className={`tw:border-x tw:border-secondary${
              onEntityClick ? ' tw:cursor-pointer' : ''
            }`}
            columns={columns}
            data-testid={entity.name}
            id={entity.id}
            key={entity.id}
            onAction={onEntityClick ? () => onEntityClick(entity) : undefined}>
            {(col) => (
              <Table.Cell key={col.id}>{renderCell(entity, col.id)}</Table.Cell>
            )}
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  );
};

export default EntityListingTable;
