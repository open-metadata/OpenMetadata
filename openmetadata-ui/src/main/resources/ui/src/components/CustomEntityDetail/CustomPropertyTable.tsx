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
import { Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import React, { FC, Fragment, useMemo, useState } from 'react';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { CustomProperty } from '../../generated/entity/type';
import { getEntityName } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import {
  CustomPropertyTableProp,
  Operation,
} from './CustomPropertyTable.interface';

export const CustomPropertyTable: FC<CustomPropertyTableProp> = ({
  customProperties,
  updateEntityType,
  hasAccess,
}) => {
  const [selectedProperty, setSelectedProperty] = useState<CustomProperty>(
    {} as CustomProperty
  );

  const [operation, setOperation] = useState<Operation>('no-operation');

  const resetSelectedProperty = () => {
    setSelectedProperty({} as CustomProperty);
    setOperation('no-operation' as Operation);
  };

  const handlePropertyDelete = () => {
    const updatedProperties = customProperties.filter(
      (property) => property.name !== selectedProperty.name
    );
    updateEntityType(updatedProperties);
    resetSelectedProperty();
  };

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

  const deleteCheck = !isEmpty(selectedProperty) && operation === 'delete';
  const updateCheck = !isEmpty(selectedProperty) && operation === 'update';

  const tableColumn: ColumnsType<CustomProperty> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: 'Type',
        dataIndex: 'propertyType',
        key: 'propertyType',
        render: (text) => getEntityName(text),
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (text) =>
          text ? (
            <RichTextEditorPreviewer markdown={text || ''} />
          ) : (
            <span
              className="tw-no-description tw-p-2 tw--ml-1.5"
              data-testid="no-description">
              {t('label.no-description')}
            </span>
          ),
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        key: 'actions',
        render: (_, record) => (
          <div className="tw-flex">
            <Tooltip title={hasAccess ? 'Edit' : NO_PERMISSION_FOR_ACTION}>
              <button
                className="tw-cursor-pointer"
                data-testid="edit-button"
                disabled={!hasAccess}
                onClick={() => {
                  setSelectedProperty(record);
                  setOperation('update');
                }}>
                <SVGIcons
                  alt="edit"
                  icon={Icons.EDIT}
                  title="Edit"
                  width="16px"
                />
              </button>
            </Tooltip>
            <Tooltip title={hasAccess ? 'Delete' : NO_PERMISSION_FOR_ACTION}>
              <button
                className="tw-cursor-pointer tw-ml-4"
                data-testid="delete-button"
                disabled={!hasAccess}
                onClick={() => {
                  setSelectedProperty(record);
                  setOperation('delete');
                }}>
                <SVGIcons
                  alt="delete"
                  icon={Icons.DELETE}
                  title="Delete"
                  width="16px"
                />
              </button>
            </Tooltip>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <Fragment>
      <Table
        bordered
        columns={tableColumn}
        data-testid="entity-custom-properties-table"
        dataSource={customProperties}
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
        visible={deleteCheck}
        onCancel={resetSelectedProperty}
        onConfirm={handlePropertyDelete}
      />
      <ModalWithMarkdownEditor
        header={t('label.edit-entity-name', {
          entityType: t('label.property'),
          entityName: selectedProperty.name,
        })}
        placeholder={t('label.enter-property-description')}
        value={selectedProperty.description || ''}
        visible={updateCheck}
        onCancel={resetSelectedProperty}
        onSave={handlePropertyUpdate}
      />
    </Fragment>
  );
};
