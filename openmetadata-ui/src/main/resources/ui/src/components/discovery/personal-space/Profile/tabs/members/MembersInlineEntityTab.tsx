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
    Autocomplete,
    Box,
    Button,
    EmptyPlaceholder,
    Typography
} from '@openmetadata/ui-core-components';
import { FC } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import Table from '../../../../../common/Table/TableV2';
import type { MembersInlineEntityTabProps } from './MembersTeamDetail.types';

const MembersInlineEntityTab: FC<MembersInlineEntityTabProps> = ({
  dataSource,
  columns,
  canEditAll,
  isAdding,
  isSavingInline,
  items,
  selectedNew,
  available,
  entityLabel,
  entityPluralLabel,
  tableTestId,
  addButtonTestId,
  addSelectTestId,
  filterOption,
  onStartAdd,
  onCancelAdd,
  onConfirmAdd,
  onItemInserted,
  onItemCleared,
}) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={3}>
      {isAdding && (
        <Box
          className="tw:border tw:border-secondary tw:rounded-xl tw:p-4"
          direction="col"
          gap={4}>
          <Typography
            className="tw:text-primary"
            size="text-sm"
            weight="semibold">
            {t('label.add-entity', { entity: entityLabel })}
          </Typography>
          <Autocomplete
            data-testid={addSelectTestId}
            filterOption={filterOption}
            items={items}
            placeholder={t('label.search-entity', { entity: entityLabel })}
            selectedItems={selectedNew.map((id) => {
              const match = available.find(
                (r) => (r.fullyQualifiedName ?? r.name) === id
              );

              return {
                id,
                label: match?.displayName || match?.name || id,
              };
            })}
            onItemCleared={(key: Key) => onItemCleared(String(key))}
            onItemInserted={(key: Key) => onItemInserted(String(key))}>
            {(item) => (
              <Autocomplete.Item id={item.id} key={item.id}>
                {item.label}
              </Autocomplete.Item>
            )}
          </Autocomplete>
          <Box direction="row" gap={3} justify="end">
            <Button color="tertiary" size="sm" onPress={onCancelAdd}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              isDisabled={selectedNew.length === 0}
              isLoading={isSavingInline}
              size="sm"
              onPress={onConfirmAdd}>
              {t('label.save')}
            </Button>
          </Box>
        </Box>
      )}
      {canEditAll && !isAdding && (
        <Box align="center" className="tw:pb-3" direction="row" justify="end">
          <Button
            color="primary"
            data-testid={addButtonTestId}
            size="sm"
            onPress={onStartAdd}>
            {t('label.add-entity', { entity: entityLabel })}
          </Button>
        </Box>
      )}
      <Table
        columns={columns}
        data-testid={tableTestId}
        dataSource={dataSource}
        locale={{
          emptyText: (
            <Box
              align="center"
              className="tw:min-h-32 tw:relative"
              justify="center">
              <EmptyPlaceholder
                description={t(
                  'message.adding-new-entity-is-easy-just-give-it-a-spin',
                  { entity: entityLabel }
                )}
                title={t('label.no-entity-found', {
                  entity: entityPluralLabel,
                })}
              />
            </Box>
          ),
        }}
        pagination={false}
        rowKey="id"
        size="small"
      />
    </Box>
  );
};

export default MembersInlineEntityTab;
