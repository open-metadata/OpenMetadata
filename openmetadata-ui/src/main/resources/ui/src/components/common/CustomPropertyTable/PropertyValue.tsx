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

import Icon from '@ant-design/icons';
import { Form, Select, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { isArray, isEmpty, isUndefined, noop, toNumber } from 'lodash';
import React, { FC, Fragment, useState } from 'react';
import { ReactComponent as EditIconComponent } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR, ICON_DIMENSION } from '../../../constants/constants';
import { Table } from '../../../generated/entity/data/table';
import {
  CustomProperty,
  EnumConfig,
} from '../../../generated/type/customProperty';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import InlineEdit from '../InlineEdit/InlineEdit.component';
import RichTextEditorPreviewer from '../RichTextEditor/RichTextEditorPreviewer';
import { PropertyInput } from './PropertyInput';

interface Props {
  versionDataKeys?: string[];
  isVersionView?: boolean;
  property: CustomProperty;
  extension: Table['extension'];
  onExtensionUpdate: (updatedExtension: Table['extension']) => Promise<void>;
  hasEditPermissions: boolean;
}

export const PropertyValue: FC<Props> = ({
  isVersionView,
  versionDataKeys,
  extension,
  onExtensionUpdate,
  hasEditPermissions,
  property,
}) => {
  const propertyName = property.name;
  const propertyType = property.propertyType;

  const value = extension?.[propertyName];

  const [showInput, setShowInput] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onShowInput = () => {
    setShowInput(true);
  };

  const onHideInput = () => {
    setShowInput(false);
  };

  const onInputSave = async (updatedValue: string | number | string[]) => {
    const isEnum = propertyType.name === 'enum';
    const isArrayType = isArray(updatedValue);
    const enumValue = isArrayType ? updatedValue : [updatedValue];
    const propertyValue = isEnum ? enumValue : updatedValue;
    try {
      const updatedExtension = {
        ...(extension || {}),
        [propertyName]:
          propertyType.name === 'integer'
            ? toNumber(updatedValue || 0)
            : propertyValue,
      };
      setIsLoading(true);
      await onExtensionUpdate(updatedExtension);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      setShowInput(false);
    }
  };

  const getPropertyInput = () => {
    switch (propertyType.name) {
      case 'string':
      case 'integer':
        return (
          <PropertyInput
            isLoading={isLoading}
            propertyName={propertyName}
            type={propertyType.name === 'integer' ? 'number' : 'text'}
            value={value}
            onCancel={onHideInput}
            onSave={onInputSave}
          />
        );
      case 'markdown':
        return (
          <ModalWithMarkdownEditor
            header={t('label.edit-entity-name', {
              entityType: t('label.property'),
              entityName: propertyName,
            })}
            placeholder={t('label.enter-property-value')}
            value={value || ''}
            visible={showInput}
            onCancel={onHideInput}
            onSave={onInputSave}
          />
        );
      case 'enum': {
        const enumConfig = property.customPropertyConfig?.config as EnumConfig;
        const isMultiSelect = Boolean(enumConfig?.multiSelect);
        const options = enumConfig?.values?.map((option) => ({
          label: option,
          value: option,
        }));

        return (
          <InlineEdit
            isLoading={isLoading}
            saveButtonProps={{
              disabled: isLoading,
              htmlType: 'submit',
              form: 'enum-form',
            }}
            onCancel={onHideInput}
            onSave={noop}>
            <Form
              id="enum-form"
              initialValues={{
                enumValues: (isArray(value) ? value : [value]).filter(Boolean),
              }}
              layout="vertical"
              onFinish={(values: { enumValues: string | string[] }) =>
                onInputSave(values.enumValues)
              }>
              <Form.Item
                name="enumValues"
                rules={[
                  {
                    required: true,
                    message: t('label.field-required', {
                      field: t('label.enum-value-plural'),
                    }),
                  },
                ]}
                style={{ marginBottom: '0px' }}>
                <Select
                  data-testid="enum-select"
                  disabled={isLoading}
                  mode={isMultiSelect ? 'multiple' : undefined}
                  options={options}
                  placeholder={t('label.enum-value-plural')}
                  style={{ width: '250px' }}
                />
              </Form.Item>
            </Form>
          </InlineEdit>
        );
      }

      default:
        return null;
    }
  };

  const getPropertyValue = () => {
    if (isVersionView) {
      const isKeyAdded = versionDataKeys?.includes(propertyName);

      return (
        <RichTextEditorPreviewer
          className={isKeyAdded ? 'diff-added' : ''}
          markdown={String(value) || ''}
        />
      );
    }
    switch (propertyType.name) {
      case 'markdown':
        return <RichTextEditorPreviewer markdown={value || ''} />;

      case 'enum':
        return (
          <Typography.Text className="break-all" data-testid="value">
            {isArray(value) ? value.join(', ') : value}
          </Typography.Text>
        );

      case 'string':
      case 'integer':
      default:
        return (
          <Typography.Text className="break-all" data-testid="value">
            {value}
          </Typography.Text>
        );
    }
  };

  const getValueElement = () => {
    const propertyValue = getPropertyValue();
    const isInteger = propertyType.name === 'integer';
    if (isInteger) {
      return !isUndefined(value) ? (
        propertyValue
      ) : (
        <span className="text-grey-muted" data-testid="no-data">
          {t('message.no-data')}
        </span>
      );
    } else {
      return !isEmpty(value) ? (
        propertyValue
      ) : (
        <span className="text-grey-muted" data-testid="no-data">
          {t('message.no-data')}
        </span>
      );
    }
  };

  return (
    <div>
      {showInput ? (
        getPropertyInput()
      ) : (
        <Fragment>
          <div className="d-flex gap-2 items-center">
            {getValueElement()}
            {hasEditPermissions && (
              <Tooltip
                placement="left"
                title={t('label.edit-entity', { entity: propertyName })}>
                <Icon
                  component={EditIconComponent}
                  data-testid="edit-icon"
                  style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                  onClick={onShowInput}
                />
              </Tooltip>
            )}
          </div>
        </Fragment>
      )}
    </div>
  );
};
