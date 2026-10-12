/*
 *  Copyright 2023 Collate.
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
  Box,
  Button,
  EmptyPlaceholder,
  Input,
  Table,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  DataQuality,
  Plus,
  Search,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataQualityDimension } from '../../../../../../generated/tests/dataQualityDimension';
import { deleteDataQualityDimension } from '../../../../../../rest/dataQualityDimensionAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import {
  countFor,
  fetchDimensionList,
  filterDimensions,
} from './DataQualitySettings.utils';
import {
  DimensionActionsCell,
  DimensionNameCell,
  DimensionTypeCell,
} from './DimensionCells';
import DimensionDeleteDialog from './DimensionDeleteDialog';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import { SettingsSkeleton } from './SettingsFormLayout';
import { useSettingsFetch } from './useSettingsFetch';

const DataQualitySettings = ({
  onNavigate,
  onSetHeaderActions,
}: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const { data, isLoading, reload } = useSettingsFetch(fetchDimensionList);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleting, setDeleting] = useState<DataQualityDimension>();
  const [isDeleting, setIsDeleting] = useState(false);

  const dimensions = useMemo(
    () => filterDimensions(data?.dimensions ?? [], searchTerm),
    [data, searchTerm]
  );

  useEffect(() => {
    onSetHeaderActions(
      <Button
        color="primary"
        data-testid="add-dimension"
        iconLeading={Plus}
        size="sm"
        onPress={() =>
          onNavigate({ type: 'page', page: 'data-quality', isEditing: true })
        }>
        {t('label.add-entity', { entity: t('label.dimension') })}
      </Button>
    );

    return () => onSetHeaderActions(undefined);
  }, [onNavigate, onSetHeaderActions, t]);

  const columns = useMemo(
    () => [
      { id: 'name', label: t('label.dimension') },
      { id: 'description', label: t('label.description') },
      { id: 'type', label: t('label.type'), className: 'tw:w-28' },
      {
        id: 'testCases',
        label: t('label.test-case-plural'),
        className: 'tw:w-28',
      },
      {
        id: 'actions',
        label: t('label.action-plural'),
        className: 'tw:w-24',
      },
    ],
    [t]
  );

  const handleDelete = async () => {
    if (!deleting?.id) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteDataQualityDimension(deleting.id);
      showSuccessToast(
        t('server.entity-deleted-successfully', {
          entity: t('label.dimension'),
        })
      );
      setDeleting(undefined);
      await reload();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderCell = (dimension: DataQualityDimension, columnId: string) => {
    switch (columnId) {
      case 'name':
        return <DimensionNameCell dimension={dimension} />;
      case 'description':
        return (
          <Typography className="tw:text-secondary" size="text-sm">
            {dimension.description || '--'}
          </Typography>
        );
      case 'type':
        return <DimensionTypeCell dimension={dimension} />;
      case 'testCases':
        // '--' rather than 0: an unknown count must not read as "unused".
        return countFor(data?.testCaseCounts, dimension) ?? '--';
      default:
        return (
          <DimensionActionsCell
            dimension={dimension}
            onDelete={setDeleting}
            onEdit={(item) =>
              onNavigate({
                type: 'page',
                page: 'data-quality',
                isEditing: true,
                itemId: item.name,
              })
            }
          />
        );
    }
  };

  if (isLoading && !data) {
    return <SettingsSkeleton rows={6} />;
  }

  return (
    <Box data-testid="data-quality-settings" direction="col" gap={4}>
      <TableCard.Root size="compact">
        <Box className="tw:border-b tw:border-secondary tw:px-4 tw:py-3">
          <Input
            className="tw:max-w-xs"
            data-testid="search-dimensions"
            icon={Search}
            placeholder={t('label.search-entity', {
              entity: t('label.dimension-plural'),
            })}
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </Box>
        <Table
          aria-label={t('label.dimension-plural')}
          data-testid="dimensions-table"
          size="compact">
          <Table.Header columns={columns}>
            {(column) => (
              <Table.Head
                className={column.className}
                id={column.id}
                isRowHeader={column.id === 'name'}
                key={column.id}
                label={column.label}
              />
            )}
          </Table.Header>
          <Table.Body
            items={dimensions}
            renderEmptyState={() => (
              <EmptyPlaceholder
                icon={<DataQuality className="tw:text-quaternary" />}
                title={
                  searchTerm
                    ? t('label.no-matching-results')
                    : t('label.no-entity', {
                        entity: t('label.dimension-plural'),
                      })
                }
              />
            )}>
            {(dimension) => (
              <Table.Row
                columns={columns}
                data-testid={`dimension-${dimension.name}`}
                id={dimension.id ?? dimension.name}
                key={dimension.id ?? dimension.name}>
                {(column) => (
                  <Table.Cell className={column.className} key={column.id}>
                    {renderCell(dimension, column.id)}
                  </Table.Cell>
                )}
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </TableCard.Root>

      <DimensionDeleteDialog
        dimension={deleting}
        isDeleting={isDeleting}
        testCaseCount={countFor(data?.testCaseCounts, deleting)}
        testDefinitionCount={countFor(data?.testDefinitionCounts, deleting)}
        onCancel={() => setDeleting(undefined)}
        onConfirm={handleDelete}
      />
    </Box>
  );
};

export default DataQualitySettings;
