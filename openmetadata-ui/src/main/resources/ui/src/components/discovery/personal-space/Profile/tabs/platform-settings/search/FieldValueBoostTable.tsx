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

import {
  Badge,
  Box,
  ButtonUtility,
  Table,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01, Trash01 } from '@openmetadata/ui-core-components/icons';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldValueBoost } from '../../../../../../../generated/configuration/searchSettings';
import { NUMERIC_COLUMNS } from './FieldValueBoostTable.constants';
import { SearchSectionTitle } from './SearchSection';

interface FieldValueBoostTableProps {
  boosts: FieldValueBoost[];
  /** The entity page shows field and factor only, as the classic page does. */
  isCompact?: boolean;
  testId: string;
  /** Actions shown at the right of the table's header row, e.g. "Add". */
  headerActions?: ReactNode;
  onEdit: (boost: FieldValueBoost) => void;
  onDelete: (field: string) => void;
}

type RangeKey = 'gt' | 'gte' | 'lt' | 'lte';

const RANGE_COLUMNS: { id: RangeKey; labelKey: string }[] = [
  { id: 'gt', labelKey: 'label.greater-than' },
  { id: 'gte', labelKey: 'label.greater-than-or-equal-to' },
  { id: 'lt', labelKey: 'label.less-than' },
  { id: 'lte', labelKey: 'label.less-than-or-equal-to' },
];

const FieldValueBoostTable = ({
  boosts,
  isCompact = false,
  testId,
  headerActions,
  onEdit,
  onDelete,
}: FieldValueBoostTableProps) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      { id: 'field', label: t('label.field') },
      { id: 'factor', label: t('label.factor') },
      ...(isCompact
        ? []
        : [
            { id: 'modifier', label: t('label.modifier') },
            { id: 'missing', label: t('label.missing-value') },
            ...RANGE_COLUMNS.map(({ id, labelKey }) => ({
              id,
              label: t(labelKey),
            })),
          ]),
      { id: 'actions', label: t('label.action-plural') },
    ],
    [isCompact, t]
  );

  const renderCell = (boost: FieldValueBoost, columnId: string) => {
    switch (columnId) {
      case 'field':
        return (
          <Typography className="tw:font-body" size="text-sm" weight="medium">
            {boost.field}
          </Typography>
        );
      case 'factor':
        return boost.factor;
      case 'modifier':
        return boost.modifier ?? '-';
      case 'missing':
        return boost.missing ?? '-';
      case 'actions':
        return (
          <Box direction="row" gap={1}>
            <ButtonUtility
              color="tertiary"
              data-testid="edit-field-value-boost-btn"
              icon={Edit01}
              size="xs"
              tooltip={t('label.edit')}
              onPress={() => onEdit(boost)}
            />
            <ButtonUtility
              color="tertiary"
              data-testid="delete-field-value-boost-btn"
              icon={Trash01}
              size="xs"
              tooltip={t('label.delete')}
              onPress={() => onDelete(boost.field)}
            />
          </Box>
        );
      default:
        return boost.condition?.range?.[columnId as RangeKey] ?? '-';
    }
  };

  return (
    <TableCard.Root size="compact" variant="muted">
      <Box
        align="center"
        className="tw:border-b tw:border-secondary tw:px-4 tw:py-3"
        direction="row"
        justify="between">
        <Box align="center" direction="row" gap={2}>
          <SearchSectionTitle>
            {t('label.field-value-boost')}
          </SearchSectionTitle>
          <Badge color="brand" size="sm" type="pill-color">
            {boosts.length}
          </Badge>
        </Box>
        {headerActions}
      </Box>
      <div className="tw:overflow-x-auto">
        <Table
          aria-label={t('label.field-value-boost')}
          data-testid={testId}
          size="compact">
          <Table.Header columns={columns}>
            {(column) => (
              <Table.Head
                className={
                  NUMERIC_COLUMNS.has(column.id)
                    ? 'tw:[&>div]:justify-end'
                    : undefined
                }
                id={column.id}
                isRowHeader={column.id === 'field'}
                key={column.id}
                label={column.label}
              />
            )}
          </Table.Header>
          <Table.Body
            items={boosts.map((boost) => ({ ...boost, id: boost.field }))}
            renderEmptyState={() => (
              <Typography
                className="tw:block tw:py-6 tw:text-center tw:text-tertiary"
                size="text-sm">
                {t('label.no-entity', { entity: t('label.field-value-boost') })}
              </Typography>
            )}>
            {(boost) => (
              <Table.Row
                columns={columns}
                data-testid={`field-value-boost-${boost.field}`}
                id={boost.field}
                key={boost.field}>
                {(column) => (
                  <Table.Cell
                    className={
                      NUMERIC_COLUMNS.has(column.id)
                        ? 'tw:text-right tw:tabular-nums'
                        : undefined
                    }
                    key={column.id}>
                    {renderCell(boost, column.id)}
                  </Table.Cell>
                )}
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </div>
    </TableCard.Root>
  );
};

export default FieldValueBoostTable;
