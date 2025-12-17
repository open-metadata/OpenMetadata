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

import {
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../Loader/Loader';
import { TableViewConfig } from '../shared/types';
import { useTableRow } from './useTableRow';

export const useDataTable = <T extends { id: string }>(
  config: TableViewConfig<T>
) => {
  const { t } = useTranslation();
  const {
    listing,
    enableSelection = true,
    entityLabelKey = 'Items',
    customTableRow,
  } = config;

  // Check if filters or search are active
  const hasActiveSearch = listing.urlState?.searchQuery?.trim();
  const hasActiveFilters =
    listing.urlState?.filters &&
    Object.values(listing.urlState.filters).some(
      (filterValues: unknown) =>
        Array.isArray(filterValues) && filterValues.length > 0
    );
  const hasActiveFiltersOrSearch = hasActiveSearch || hasActiveFilters;

  const dataTable = useMemo(
    () => (
      <Table>
        <TableHead>
          <TableRow>
            {enableSelection && (
              <TableCell padding="checkbox">
                <Checkbox
                  checked={listing.isAllSelected}
                  indeterminate={listing.isIndeterminate}
                  size="medium"
                  onChange={(e) => {
                    e.stopPropagation();
                    listing.handleSelectAll(e.target.checked);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                />
              </TableCell>
            )}
            {listing.columns.map((column) => (
              <TableCell key={column.key}>{t(column.labelKey)}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {listing.loading ? (
            <TableRow>
              <TableCell
                align="center"
                colSpan={listing.columns.length + (enableSelection ? 1 : 0)}>
                <Loader />
              </TableCell>
            </TableRow>
          ) : isEmpty(listing.entities) && hasActiveFiltersOrSearch ? (
            <TableRow>
              <TableCell
                align="center"
                colSpan={listing.columns.length + (enableSelection ? 1 : 0)}>
                {t('server.no-records-found')}
              </TableCell>
            </TableRow>
          ) : (
            listing.entities.map((entity) => {
              if (customTableRow) {
                const CustomTableRow = customTableRow;

                return (
                  <CustomTableRow
                    entity={entity}
                    isSelected={listing.isSelected(entity.id)}
                    key={entity.id}
                    onEntityClick={
                      listing.actionHandlers.onEntityClick || (() => {})
                    }
                    onSelect={listing.handleSelect}
                  />
                );
              }

              // Use useTableRow hook instead of EntityTableRow component
              const TableRowHook = () => {
                const { tableRow } = useTableRow({
                  entity,
                  columns: listing.columns,
                  renderers: listing.renderers,
                  isSelected: listing.isSelected(entity.id),
                  onSelect: listing.handleSelect,
                  onEntityClick:
                    listing.actionHandlers.onEntityClick || (() => {}),
                  enableSelection,
                });

                return tableRow;
              };

              return <TableRowHook key={entity.id} />;
            })
          )}
        </TableBody>
      </Table>
    ),
    [listing, enableSelection, hasActiveFiltersOrSearch, customTableRow, t]
  );

  return {
    dataTable,
    isEmpty: isEmpty(listing.entities),
    hasActiveFiltersOrSearch,
    selectedCount: listing.selectedEntities.length,
    entityLabelKey,
  };
};
