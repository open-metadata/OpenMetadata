/*
 *  Copyright 2025 Collate.
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

import { Button, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isArray, isEmpty, isNil, isUndefined, omitBy, toNumber } from 'lodash';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIconComponent } from '../../../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
} from '../../../../constants/constants';
import { CustomProperty } from '../../../../generated/entity/type';
import { CustomPropertyValueRenderer } from '../../../../utils/CustomPropertyRenderers';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { PropertyValueType } from '../../../common/CustomPropertyTable/CustomPropertyTable.interface';
import { ExtensionDataProps } from '../../../Modals/ModalWithCustomProperty/ModalWithMarkdownEditor.interface';
import './CustomPropertiesSection.less';
import CustomPropertyInput from './CustomPropertyInput';

const CustomPropertyItem: FC<{
  property: CustomProperty;
  value: PropertyValueType | undefined;
  hasEditPermissions: boolean;
  onExtensionUpdate: (
    updatedExtension: Record<string, unknown> | undefined
  ) => Promise<void>;
  extensionData: ExtensionDataProps;
}> = ({
  property,
  value,
  hasEditPermissions,
  onExtensionUpdate,
  extensionData,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const onShowInput = () => {
    setIsEditing(true);
  };

  const onHideInput = () => {
    setIsEditing(false);
  };

  const onInputSave = async (updatedValue: PropertyValueType) => {
    const isEnum = property.propertyType.name === 'enum';
    const isArrayType = isArray(updatedValue);
    const enumValue = isArrayType ? updatedValue : [updatedValue];
    let propertyValue: PropertyValueType | undefined | null = isEnum
      ? (enumValue as string[]).filter(Boolean)
      : updatedValue;

    if (
      property.propertyType.name === 'entityReference' &&
      (isNil(propertyValue) || isEmpty(propertyValue))
    ) {
      propertyValue = null;
    }

    try {
      const updatedExtension = omitBy(
        {
          ...(extensionData ?? {}),
          [property.name]: ['integer', 'number'].includes(
            property.propertyType.name ?? ''
          )
            ? updatedValue
              ? toNumber(updatedValue)
              : updatedValue
            : propertyValue,
        },
        isUndefined
      );

      setIsLoading(true);
      await onExtensionUpdate(
        isEmpty(updatedExtension) ? undefined : updatedExtension
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };

  return (
    <div
      className="custom-property-item"
      data-testid={`custom-property-${property.name}-card`}
      key={property.name}
      onDoubleClick={hasEditPermissions ? onShowInput : undefined}>
      <Typography.Text
        className="property-name"
        data-testid={`property-${property.name}-name`}>
        {property.displayName || property.name}
      </Typography.Text>
      <div className="property-value" data-testid="value">
        {isEditing ? (
          <CustomPropertyInput
            isLoading={isLoading}
            property={property}
            value={value}
            onHideInput={onHideInput}
            onInputSave={onInputSave}
          />
        ) : (
          <div className="d-flex items-center gap-2">
            <CustomPropertyValueRenderer property={property} value={value} />
            {hasEditPermissions && (
              <Tooltip
                placement="top"
                title={t('label.edit-entity', {
                  entity: property.displayName || property.name,
                })}>
                <Button
                  className="p-0"
                  data-testid="edit-icon"
                  icon={
                    <EditIconComponent
                      style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                    />
                  }
                  size="small"
                  type="text"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowInput();
                  }}
                />
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomPropertyItem;
