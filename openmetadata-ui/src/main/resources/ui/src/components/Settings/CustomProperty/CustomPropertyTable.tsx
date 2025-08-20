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
import { Button, Space, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isArray, isEmpty, isString, isUndefined, startCase } from 'lodash';
import { FC, Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import IconEdit from '../../../assets/svg/edit-new.svg?react';
import IconDelete from '../../../assets/svg/ic-delete.svg?react';
import { CUSTOM_PROPERTIES_ICON_MAP } from '../../../constants/CustomProperty.constants';
import { ADD_CUSTOM_PROPERTIES_DOCS } from '../../../constants/docs.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { TABLE_SCROLL_VALUE } from '../../../constants/Table.constants';
import { ERROR_PLACEHOLDER_TYPE, OPERATION } from '../../../enums/common.enum';
import { CustomProperty } from '../../../generated/type/customProperty';
import { columnSorter, getEntityName } from '../../../utils/EntityUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../common/Table/Table';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';
import './custom-property-table.less';
import { CustomPropertyTableProp } from './CustomPropertyTable.interface';
import EditCustomPropertyModal, {
  FormData,
} from './EditCustomPropertyModal/EditCustomPropertyModal';

export const CustomPropertyTable: FC<CustomPropertyTableProp> = ({
  customProperties,
  updateEntityType,
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

  const handlePropertyDelete = () => {
    const updatedProperties = customProperties.filter(
      (property) => property.name !== selectedProperty.name
    );
    updateEntityType(updatedProperties);
  };

  useEffect(() => {
    if (!isButtonLoading) {
      resetSelectedProperty();
    }
  }, [isButtonLoading]);

  const handlePropertyUpdate = async (data: FormData) => {
    const updatedProperties = customProperties.map((property) => {
      if (property.name === selectedProperty.name) {
        const config = data.customPropertyConfig;
        const isEnumType = selectedProperty.propertyType.name === 'enum';

        return {
          ...property,
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
        };
      } else {
        return property;
      }
    });
    await updateEntityType(updatedProperties);
    resetSelectedProperty();
  };

  const deleteCheck = useMemo(
    () => !isEmpty(selectedProperty) && operation === OPERATION.DELETE,
    [selectedProperty, operation]
  );
  const updateCheck = useMemo(
    () => !isEmpty(selectedProperty) && operation === OPERATION.UPDATE,
    [selectedProperty, operation]
  );

  const tableColumn: ColumnsType<CustomProperty> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (_, record) => getEntityName(record),
        sorter: columnSorter,
      },
      {
        title: t('label.type'),
        dataIndex: 'propertyType',
        key: 'propertyType',
        render: (propertyType: CustomProperty['propertyType']) => {
          const Icon =
            CUSTOM_PROPERTIES_ICON_MAP[
              propertyType.name as keyof typeof CUSTOM_PROPERTIES_ICON_MAP
            ];

          return (
            <div className="d-flex gap-2 custom-property-type-chip items-center">
              {Icon && <Icon width={20} />}
              <span>
                {startCase(getEntityName(propertyType).replace(/-cp/g, ''))}
              </span>
            </div>
          );
        },
      },
      {
        title: t('label.config'),
        dataIndex: 'customPropertyConfig',
        key: 'customPropertyConfig',
        render: (data: CustomProperty['customPropertyConfig'], record) => {
          if (isUndefined(data)) {
            return <span>--</span>;
          }

          const config = data.config;

          // If config is an array and not empty
          if (isArray(config) && !isEmpty(config)) {
            return (
              <Typography.Text data-testid={`${record.name}-config`}>
                {JSON.stringify(config ?? [])}
              </Typography.Text>
            );
          }

          // If config is an object, then it is a enum config
          if (!isString(config) && !isArray(config)) {
            if (config?.columns) {
              return (
                <div className="w-full d-flex gap-2 flex-column">
                  <Typography.Text>
                    <span className="font-medium">{`${t(
                      'label.column-plural'
                    )}:`}</span>
                    <ul className="m-b-0">
                      {config.columns.map((column) => (
                        <li key={column}>{column}</li>
                      ))}
                    </ul>
                  </Typography.Text>
                </div>
              );
            }

            return (
              <div
                className="w-full d-flex gap-2 flex-column"
                data-testid="enum-config">
                <Typography.Text>
                  {JSON.stringify(config?.values ?? [])}
                </Typography.Text>
                <Typography.Text>
                  {t('label.multi-select')}:{' '}
                  {config?.multiSelect ? t('label.yes') : t('label.no')}
                </Typography.Text>
              </div>
            );
          }

          // else it is a string
          return <Typography.Text>{config}</Typography.Text>;
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 300,
        render: (text) =>
          text ? (
            <RichTextEditorPreviewerNew markdown={text ?? ''} />
          ) : (
            <Typography.Text
              className="text-grey-muted "
              data-testid="no-description">
              {t('label.no-description')}
            </Typography.Text>
          ),
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 80,
        fixed: 'right',
        render: (_, record) => (
          <Space align="center" size={14}>
            <Tooltip
              title={
                hasAccess
                  ? t('label.edit-entity', {
                      entity: t('label.property'),
                    })
                  : NO_PERMISSION_FOR_ACTION
              }>
              <Button
                className="cursor-pointer p-0"
                data-testid="edit-button"
                disabled={!hasAccess}
                size="small"
                type="text"
                onClick={() => {
                  setSelectedProperty(record);
                  setOperation(OPERATION.UPDATE);
                }}>
                <IconEdit name={t('label.edit')} width={16} />
              </Button>
            </Tooltip>
            <Tooltip
              title={
                hasAccess
                  ? t('label.delete-entity', {
                      entity: t('label.property'),
                    })
                  : NO_PERMISSION_FOR_ACTION
              }>
              <Button
                className="cursor-pointer p-0"
                data-testid="delete-button"
                disabled={!hasAccess}
                size="small"
                type="text"
                onClick={() => {
                  setSelectedProperty(record);
                  setOperation(OPERATION.DELETE);
                }}>
                <IconDelete name={t('label.delete')} width={16} />
              </Button>
            </Tooltip>
          </Space>
        ),
      },
    ],
    [hasAccess]
  );

  return (
    <Fragment>
      <Table
        columns={tableColumn}
        containerClassName="entity-custom-properties-table"
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
        scroll={TABLE_SCROLL_VALUE}
        size="small"
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
