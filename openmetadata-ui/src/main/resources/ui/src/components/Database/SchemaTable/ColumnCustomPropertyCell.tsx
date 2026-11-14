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

import { ButtonUtility } from '@openmetadata/ui-core-components';
import { Edit01, Plus } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { Column } from '../../../generated/entity/data/table';
import { CustomProperty } from '../../../generated/type/customProperty';
import { buildUpdatedExtension } from '../../../utils/CustomProperty.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { isPropertyValueEmpty } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import { CustomPropertyEditModal } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyEditModal';
import { getPropertyRenderer } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyRenderers';

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

  const editTitle = t('label.edit-entity', { entity: getEntityName(property) });

  const renderValue = () => {
    if (!isEmptyValue) {
      return <View isCompact property={property} value={value} />;
    }

    return hasEditPermissions ? (
      <ButtonUtility
        className="tw:mt-2"
        data-testid="add-icon"
        icon={Plus}
        size="xs"
        tooltip={t('label.add-entity', { entity: getEntityName(property) })}
        onClick={() => setIsEditing(true)}
      />
    ) : (
      NO_DATA_PLACEHOLDER
    );
  };

  return (
    <div
      className="hover-icon-group tw:flex tw:min-w-0 tw:flex-col tw:items-start tw:gap-1 tw:text-xs"
      data-testid={property.name}>
      <div
        className="tw:flex tw:min-w-0 tw:max-w-full"
        data-testid="property-value">
        {renderValue()}
      </div>
      {hasEditPermissions && !isEmptyValue && (
        <ButtonUtility
          className="hover-cell-icon"
          data-testid="edit-icon"
          icon={Edit01}
          size="xs"
          tooltip={editTitle}
          onClick={() => setIsEditing(true)}
        />
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
