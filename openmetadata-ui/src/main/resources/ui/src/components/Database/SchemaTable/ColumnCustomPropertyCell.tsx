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

import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Column } from '../../../generated/entity/data/table';
import { CustomProperty } from '../../../generated/type/customProperty';
import { buildUpdatedExtension } from '../../../utils/CustomProperty.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { isPropertyValueEmpty } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import { CustomPropertyEditModal } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyEditModal';
import { getPropertyRenderer } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyRenderers';
import { WidgetEditButton } from '../../common/WidgetActionButton/WidgetActionButton';

export interface ColumnCustomPropertyCellProps {
  property: CustomProperty;
  record: Column;
  hasEditPermissions: boolean;
  onExtensionUpdate: (
    record: Column,
    updatedExtension: Column['extension']
  ) => Promise<void>;
}

export const ColumnCustomPropertyCell: FC<ColumnCustomPropertyCellProps> = ({
  property,
  record,
  hasEditPermissions,
  onExtensionUpdate,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const typeName = property.propertyType.name;
  const { View } = getPropertyRenderer(typeName);
  const value = (record.extension as Record<string, unknown> | undefined)?.[
    property.name
  ];
  const isEmptyValue = isPropertyValueEmpty(typeName, value);

  const handleSave = async (updatedValue: unknown) => {
    setIsSaving(true);
    try {
      await onExtensionUpdate(
        record,
        buildUpdatedExtension(
          record.extension as Record<string, unknown> | undefined,
          property.name,
          typeName ?? '',
          updatedValue
        )
      );
      setIsEditing(false);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="tw:group tw:flex tw:min-w-0 tw:items-start tw:gap-1"
      data-testid={property.name}>
      <div
        className={classNames('tw:min-w-0 tw:flex-1 tw:text-xs', {
          'tw:text-tertiary': isEmptyValue,
        })}
        data-testid="property-value">
        {isEmptyValue ? (
          t('label.not-set')
        ) : (
          <View isCompact property={property} value={value} />
        )}
      </div>
      {hasEditPermissions && (
        // Empty cells keep the icon visible: it is their only edit affordance.
        <span
          className={classNames('tw:flex tw:shrink-0', {
            'tw:opacity-0 tw:group-hover:opacity-100 tw:group-focus-within:opacity-100':
              !isEmptyValue,
          })}>
          <WidgetEditButton
            data-testid="edit-icon"
            title={t('label.edit-entity', { entity: getEntityName(property) })}
            onClick={() => setIsEditing(true)}
          />
        </span>
      )}
      {isEditing && (
        <CustomPropertyEditModal
          isNewValue={isEmptyValue}
          isSaving={isSaving}
          property={property}
          value={value}
          onCancel={() => setIsEditing(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default ColumnCustomPropertyCell;
