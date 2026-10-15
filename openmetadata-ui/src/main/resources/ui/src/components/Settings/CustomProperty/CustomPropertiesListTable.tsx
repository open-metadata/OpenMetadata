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
  Dropdown,
  EmptyPlaceholder,
  FilterSelect,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit05, Trash01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OPERATION } from '../../../enums/common.enum';
import { CustomProperty } from '../../../generated/type/customProperty';
import { getTextFromHtmlString } from '../../../utils/BlockEditorPureUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { columnSorter } from '../../../utils/EntitySortUtils';
import { ColumnsType } from '../../common/Table/Table.interface';
import Table from '../../common/Table/TableV2';
import {
  CustomPropertiesListTableProps,
  CustomPropertyActionsProps,
  CustomPropertyConfigCellProps,
} from './CustomPropertiesListTable.interface';
import {
  filterCustomProperties,
  getPropertyConfigSummary,
  getPropertyTypeBadge,
  getPropertyTypeOptions,
} from './CustomPropertyTable.utils';

const MAX_VISIBLE_CONFIG_VALUES = 3;

const CONFIG_CHIP_CLASS = 'tw:max-w-full tw:truncate tw:font-medium';
const ACTIONS_BUTTON_CLASS = classNames(
  'tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-lg',
  'tw:border tw:border-transparent tw:hover:border-secondary tw:hover:bg-primary_hover',
  'tw:[&>svg]:size-4'
);

const CustomPropertyConfigCell: FC<CustomPropertyConfigCellProps> = ({
  property,
}) => {
  const { t } = useTranslation();
  const summary = getPropertyConfigSummary(property, t);

  if (!summary) {
    return (
      <Typography
        className="tw:text-fg-quaternary"
        data-testid="no-config"
        size="text-sm">
        —
      </Typography>
    );
  }

  const visibleValues = summary.values.slice(0, MAX_VISIBLE_CONFIG_VALUES);
  const hiddenCount = summary.values.length - visibleValues.length;

  return (
    <Box className="tw:gap-1.5" data-testid={summary.testId} direction="col">
      <Typography className="tw:text-quaternary" size="text-xs" weight="medium">
        {summary.label}
      </Typography>
      <Box gap={1} wrap="wrap">
        {visibleValues.map((value) => (
          <Badge
            className={CONFIG_CHIP_CLASS}
            color="gray"
            data-testid="config-value"
            key={value}
            size="sm"
            type="color">
            {value}
          </Badge>
        ))}
        {hiddenCount > 0 && (
          <Badge
            className="tw:font-medium tw:text-tertiary"
            color="gray"
            data-testid="config-hidden-count"
            size="sm"
            type="color">
            {t('label.plus-count', { count: hiddenCount })}
          </Badge>
        )}
      </Box>
    </Box>
  );
};

const CustomPropertyActions: FC<CustomPropertyActionsProps> = ({
  property,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();

  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <Dropdown.Root>
      <Dropdown.DotsButton
        className={ACTIONS_BUTTON_CLASS}
        data-testid="property-actions"
      />
      <Dropdown.Popover className="tw:w-55">
        <Dropdown.Menu
          aria-label={t('label.action-plural')}
          selectionMode="none"
          onAction={(key) =>
            key === OPERATION.DELETE ? onDelete(property) : onEdit(property)
          }>
          {canEdit && (
            <Dropdown.Item
              data-testid="edit-button"
              icon={Edit05}
              id={OPERATION.UPDATE}
              label={t('label.edit')}
            />
          )}
          {canEdit && canDelete && <Dropdown.Separator />}
          {canDelete && (
            <Dropdown.Item
              data-testid="delete-button"
              id={OPERATION.DELETE}
              textValue={t('label.delete')}>
              <Box align="center" gap={2}>
                <Trash01
                  aria-hidden="true"
                  className="tw:size-4 tw:shrink-0 tw:text-fg-error-primary"
                />
                <Typography color="danger" size="text-sm">
                  {t('label.delete')}
                </Typography>
              </Box>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

const CustomPropertiesListTable: FC<CustomPropertiesListTableProps> = ({
  customProperties,
  isLoading,
  canEdit,
  canDelete,
  emptyText,
  containerClassName,
  'data-testid': dataTestId = 'entity-custom-properties-table',
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);

  const typeOptions = useMemo(
    () => getPropertyTypeOptions(customProperties, t),
    [customProperties, t]
  );

  // Types whose last property was removed drop out of the active filter.
  const activeTypeFilters = useMemo(
    () =>
      typeFilters.filter((type) =>
        typeOptions.some(({ value }) => value === type)
      ),
    [typeFilters, typeOptions]
  );
  const isFiltered = Boolean(searchText) || activeTypeFilters.length > 0;

  const filteredProperties = useMemo(
    () =>
      filterCustomProperties(customProperties, searchText, activeTypeFilters),
    [customProperties, searchText, activeTypeFilters]
  );

  const tableColumns: ColumnsType<CustomProperty> = useMemo(
    () => [
      {
        title: t('label.property'),
        dataIndex: 'name',
        key: 'name',
        width: '41%',
        sorter: columnSorter,
        render: (_, record) => {
          const description = getTextFromHtmlString(record.description);

          return (
            <Box className="tw:min-w-0 tw:gap-0.5" direction="col">
              <Typography
                ellipsis
                className="tw:text-primary"
                data-testid="property-name"
                size="text-sm"
                weight="medium">
                {getEntityName(record)}
              </Typography>
              {description && (
                <Typography
                  className="tw:text-left tw:text-tertiary"
                  data-testid="property-description"
                  ellipsis={{ rows: 2, tooltip: description }}
                  size="text-sm">
                  {description}
                </Typography>
              )}
            </Box>
          );
        },
      },
      {
        title: t('label.type'),
        dataIndex: 'propertyType',
        key: 'propertyType',
        width: '20%',
        render: (propertyType: CustomProperty['propertyType']) => {
          const typeBadge = getPropertyTypeBadge(propertyType, t);

          return (
            <Badge
              className="tw:px-[7px] tw:font-medium"
              color={typeBadge.color}
              data-testid="property-type"
              size="sm"
              type="color">
              {typeBadge.label}
            </Badge>
          );
        },
      },
      {
        title: t('label.configuration'),
        dataIndex: 'customPropertyConfig',
        key: 'customPropertyConfig',
        render: (_, record) => <CustomPropertyConfigCell property={record} />,
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 80,
        render: (_, record) => (
          <CustomPropertyActions
            canDelete={canDelete}
            canEdit={canEdit}
            property={record}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ),
      },
    ],
    [canDelete, canEdit, onDelete, onEdit, t]
  );

  return (
    <Table
      cellClassName="tw:p-4 tw:align-top"
      columns={tableColumns}
      containerClassName={classNames('tw:rounded-xl', containerClassName)}
      data-testid={dataTestId}
      dataSource={filteredProperties}
      extraTableFilters={
        <FilterSelect
          bordered
          data-testid="custom-property-type-filter"
          label={t('label.type')}
          options={typeOptions}
          selectedValues={activeTypeFilters}
          selectionMode="multiple"
          triggerVariant="button"
          onChange={setTypeFilters}
        />
      }
      loading={isLoading}
      locale={{
        emptyText: isFiltered ? (
          <EmptyPlaceholder
            description={t('message.try-adjusting-filter')}
            title={t('label.no-entity-found', {
              entity: t('label.property-plural'),
            })}
          />
        ) : (
          emptyText
        ),
      }}
      pagination={false}
      rowKey="name"
      searchProps={{
        containerClassName: 'tw:max-w-80',
        placeholder: t('label.search-entity', {
          entity: t('label.property-plural'),
        }),
        searchBarDataTestId: 'custom-property-search',
        searchValue: searchText,
        typingInterval: 300,
        onSearch: setSearchText,
      }}
    />
  );
};

export default CustomPropertiesListTable;
