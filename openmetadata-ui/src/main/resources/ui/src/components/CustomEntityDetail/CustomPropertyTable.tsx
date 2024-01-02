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
import { isEmpty } from 'lodash';
import React, { FC, Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../assets/svg/ic-delete.svg';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Table from '../../components/common/Table/Table';
import { CUSTOM_PROPERTIES_DOCS } from '../../constants/docs.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { ERROR_PLACEHOLDER_TYPE, OPERATION } from '../../enums/common.enum';
import { CustomProperty } from '../../generated/entity/type';
import { getEntityName } from '../../utils/EntityUtils';
import RichTextEditorPreviewer from '../common/RichTextEditor/RichTextEditorPreviewer';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { CustomPropertyTableProp } from './CustomPropertyTable.interface';

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

  const handlePropertyUpdate = async (updatedDescription: string) => {
    const updatedProperties = customProperties.map((property) => {
      if (property.name === selectedProperty.name) {
        return { ...property, description: updatedDescription };
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
      },
      {
        title: t('label.type'),
        dataIndex: 'propertyType',
        key: 'propertyType',
        render: (text) => getEntityName(text),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text) =>
          text ? (
            <RichTextEditorPreviewer markdown={text || ''} />
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
        render: (_, record) => (
          <Space align="center" size={14}>
            <Tooltip title={!hasAccess && NO_PERMISSION_FOR_ACTION}>
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
            <Tooltip title={!hasAccess && NO_PERMISSION_FOR_ACTION}>
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
        bordered
        columns={tableColumn}
        data-testid="entity-custom-properties-table"
        dataSource={customProperties}
        loading={isLoading}
        locale={{
          emptyText: (
            <ErrorPlaceHolder
              className="mt-xs"
              doc={CUSTOM_PROPERTIES_DOCS}
              heading={t('label.property')}
              permission={hasAccess}
              type={ERROR_PLACEHOLDER_TYPE.CREATE}
            />
          ),
        }}
        pagination={false}
        rowKey="name"
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
      <ModalWithMarkdownEditor
        header={t('label.edit-entity-name', {
          entityType: t('label.property'),
          entityName: selectedProperty.name,
        })}
        placeholder={t('label.enter-field-description', {
          field: t('label.property'),
        })}
        value={selectedProperty.description || ''}
        visible={updateCheck}
        onCancel={resetSelectedProperty}
        onSave={handlePropertyUpdate}
      />
    </Fragment>
  );
};
