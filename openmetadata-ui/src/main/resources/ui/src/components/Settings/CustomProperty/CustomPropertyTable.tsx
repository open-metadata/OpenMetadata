/*
 *  Copyright 2022 Collate.
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
import { Badge, Dropdown, Typography } from '@openmetadata/ui-core-components';
import { Edit05, Trash01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { FC, Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ADD_CUSTOM_PROPERTIES_DOCS } from '../../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE, OPERATION } from '../../../enums/common.enum';
import { CustomProperty } from '../../../generated/type/customProperty';
import { getTextFromHtmlString } from '../../../utils/BlockEditorPureUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { columnSorter } from '../../../utils/EntitySortUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ColumnsType } from '../../common/Table/Table.interface';
import Table from '../../common/Table/TableV2';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';
import {
  CustomPropertyActionsProps,
  CustomPropertyConfigCellProps,
  CustomPropertyTableProp,
} from './CustomPropertyTable.interface';
import {
  getPropertyConfigSummary,
  getPropertyTypeBadge,
} from './CustomPropertyTable.utils';
import EditCustomPropertyModal, {
  FormData,
} from './EditCustomPropertyModal/EditCustomPropertyModal';

const MAX_VISIBLE_CONFIG_VALUES = 3;

const HEAD_LABEL_CLASS = 'tw:text-xs tw:font-medium tw:text-tertiary';
const CONFIG_CHIP_CLASS = 'tw:max-w-full tw:truncate tw:font-medium';
const ACTIONS_BUTTON_CLASS = classNames(
  'tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-lg',
  'tw:border tw:border-transparent tw:hover:border-secondary tw:hover:bg-primary_hover',
  'tw:disabled:cursor-not-allowed tw:disabled:text-fg-disabled tw:[&>svg]:size-4'
);

const CustomPropertyConfigCell: FC<CustomPropertyConfigCellProps> = ({
  property,
}) => {
  const { t } = useTranslation();
  const summary = getPropertyConfigSummary(property, t);

  if (!summary) {
    return (
      <span
        className="tw:text-sm tw:text-fg-quaternary"
        data-testid="no-config">
        —
      </span>
    );
  }

  const visibleValues = summary.values.slice(0, MAX_VISIBLE_CONFIG_VALUES);
  const hiddenCount = summary.values.length - visibleValues.length;

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-1.5"
      data-testid={summary.testId}>
      <span className="tw:text-xs tw:font-medium tw:text-quaternary">
        {summary.label}
      </span>
      <div className="tw:flex tw:flex-wrap tw:gap-1">
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
      </div>
    </div>
  );
};

const CustomPropertyActions: FC<CustomPropertyActionsProps> = ({
  property,
  hasAccess,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();

  return (
    <Dropdown.Root>
      <Dropdown.DotsButton
        className={ACTIONS_BUTTON_CLASS}
        data-testid="property-actions"
        isDisabled={!hasAccess}
      />
      <Dropdown.Popover className="tw:w-55">
        <Dropdown.Menu
          aria-label={t('label.action-plural')}
          onAction={(key) =>
            key === OPERATION.DELETE ? onDelete(property) : onEdit(property)
          }>
          <Dropdown.Item
            data-testid="edit-button"
            icon={Edit05}
            id={OPERATION.UPDATE}
            label={t('label.edit')}
          />
          <Dropdown.Separator />
          <Dropdown.Item
            data-testid="delete-button"
            id={OPERATION.DELETE}
            textValue={t('label.delete')}>
            <span className="tw:flex tw:items-center tw:gap-2 tw:text-error-primary">
              <Trash01
                aria-hidden="true"
                className="tw:size-4 tw:shrink-0 tw:text-fg-error-primary"
              />
              {t('label.delete')}
            </span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export const CustomPropertyTable: FC<CustomPropertyTableProp> = ({
  customProperties,
  onDeleteProperty,
  onUpdateProperty,
  hasAccess,
  isLoading,
  isButtonLoading,
}) => {
  const { t } = useTranslation();
  const [selectedProperty, setSelectedProperty] = useState<CustomProperty>(
    {} as CustomProperty
  );
  const [operation, setOperation] = useState<OPERATION>(OPERATION.NO_OPERATION);

  const resetSelectedProperty = () => {
    setSelectedProperty({} as CustomProperty);
    setOperation(OPERATION.NO_OPERATION);
  };

  const handlePropertyDelete = () => onDeleteProperty(selectedProperty.name);

  useEffect(() => {
    if (!isButtonLoading) {
      resetSelectedProperty();
    }
  }, [isButtonLoading]);

  const handlePropertyUpdate = async (data: FormData) => {
    const config = data.customPropertyConfig;
    const isEnumType = selectedProperty.propertyType.name === 'enum';

    await onUpdateProperty(selectedProperty.name, {
      description: data.description,
      displayName: data.displayName,
      ...(config
        ? {
            customPropertyConfig: {
              config: isEnumType
                ? {
                    multiSelect: Boolean(data?.multiSelect),
                    values: config,
                  }
                : (config as string[]),
            },
          }
        : {}),
    });
    resetSelectedProperty();
  };

  const handleEdit = useCallback((property: CustomProperty) => {
    setSelectedProperty(property);
    setOperation(OPERATION.UPDATE);
  }, []);

  const handleDelete = useCallback((property: CustomProperty) => {
    setSelectedProperty(property);
    setOperation(OPERATION.DELETE);
  }, []);

  const deleteCheck = useMemo(
    () => !isEmpty(selectedProperty) && operation === OPERATION.DELETE,
    [selectedProperty, operation]
  );
  const updateCheck = useMemo(
    () => !isEmpty(selectedProperty) && operation === OPERATION.UPDATE,
    [selectedProperty, operation]
  );

  const tableColumns: ColumnsType<CustomProperty> = useMemo(
    () => [
      {
        title: <span className={HEAD_LABEL_CLASS}>{t('label.property')}</span>,
        dataIndex: 'name',
        key: 'name',
        width: '41%',
        sorter: columnSorter,
        render: (_, record) => {
          const description = getTextFromHtmlString(record.description);

          return (
            <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
              <span
                className="tw:truncate tw:text-sm tw:font-medium tw:text-primary"
                data-testid="property-name">
                {getEntityName(record)}
              </span>
              {description && (
                <Typography
                  className="tw:text-left tw:text-tertiary"
                  data-testid="property-description"
                  ellipsis={{ rows: 2, tooltip: description }}
                  size="text-sm">
                  {description}
                </Typography>
              )}
            </div>
          );
        },
      },
      {
        title: <span className={HEAD_LABEL_CLASS}>{t('label.type')}</span>,
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
        title: (
          <span className={HEAD_LABEL_CLASS}>{t('label.configuration')}</span>
        ),
        dataIndex: 'customPropertyConfig',
        key: 'customPropertyConfig',
        render: (_, record) => <CustomPropertyConfigCell property={record} />,
      },
      {
        title: <span className="tw:sr-only">{t('label.action-plural')}</span>,
        dataIndex: 'actions',
        key: 'actions',
        width: 64,
        render: (_, record) => (
          <CustomPropertyActions
            hasAccess={hasAccess}
            property={record}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        ),
      },
    ],
    [hasAccess, handleDelete, handleEdit, t]
  );

  return (
    <Fragment>
      <Table
        cellClassName="tw:p-4 tw:align-top"
        columns={tableColumns}
        containerClassName="tw:rounded-xl"
        data-testid="entity-custom-properties-table"
        dataSource={customProperties}
        loading={isLoading}
        locale={{
          emptyText: (
            <ErrorPlaceHolder
              className="mt-xs border-none"
              doc={ADD_CUSTOM_PROPERTIES_DOCS}
              heading={t('label.property')}
              permission={hasAccess}
              permissionValue={t('label.create-entity', {
                entity: t('label.custom-property'),
              })}
              type={ERROR_PLACEHOLDER_TYPE.CREATE}
            />
          ),
        }}
        pagination={false}
        rowKey="name"
      />
      <ConfirmationModal
        bodyText={t('message.are-you-sure-delete-property', {
          propertyName: selectedProperty.name,
        })}
        cancelText={t('label.cancel')}
        confirmText={t('label.confirm')}
        header={t('label.delete-property-name', {
          propertyName: selectedProperty.name,
        })}
        isLoading={isButtonLoading}
        visible={deleteCheck}
        onCancel={resetSelectedProperty}
        onConfirm={handlePropertyDelete}
      />
      {updateCheck && (
        <EditCustomPropertyModal
          customProperty={selectedProperty}
          visible={updateCheck}
          onCancel={resetSelectedProperty}
          onSave={handlePropertyUpdate}
        />
      )}
    </Fragment>
  );
};
