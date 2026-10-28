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
  Box,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit02 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../../constants/constants';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import {
  getPropertyTypeMeta,
  isPropertyValueEmpty,
} from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import { CustomPropertyHeader } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyHeader';
import { getPropertyRenderer } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyRenderers';

interface CustomPropertyRowProps {
  property: CustomProperty;
  value: unknown;
  canEdit: boolean;
  isEditing: boolean;
  isSaving: boolean;
  onEdit: (property: CustomProperty) => void;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}

/**
 * One custom property: the shared property header on the left, the
 * value on the right. Editing happens in place; Save submits the type's own
 * editor form, so every type keeps its validation and value shape.
 */
const CustomPropertyRow = ({
  property,
  value,
  canEdit,
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
}: CustomPropertyRowProps) => {
  const { t } = useTranslation();
  const formId = useId();
  const [isDirty, setIsDirty] = useState(false);
  const typeName = property.propertyType.name;
  const meta = getPropertyTypeMeta(typeName);
  const { View, Edit } = getPropertyRenderer(typeName);
  const label = getEntityName(property);

  // A column, so the type's editor form stretches to the full width and its
  // right edge lines up with Cancel / Save changes; a row would shrink it.
  const editor = (
    <Box
      className={classNames(
        'tw:min-w-0',
        meta.isWide ? 'tw:w-full' : 'tw:w-120 tw:max-w-full'
      )}
      data-testid="custom-property-editor"
      direction="col">
      <Edit
        formId={formId}
        isSaving={isSaving}
        property={property}
        value={value}
        onDirtyChange={setIsDirty}
        onSave={onSave}
      />
    </Box>
  );

  const renderValue = () =>
    isPropertyValueEmpty(typeName, value) ? (
      <Typography color="secondary" data-testid="no-value">
        {NO_DATA_PLACEHOLDER}
      </Typography>
    ) : (
      <View isCompact property={property} value={value} />
    );

  return (
    <Box
      className="tw:px-5 tw:py-4"
      data-testid={`custom-property-row-${property.name}`}
      direction="col"
      gap={4}>
      <Box align="center" gap={6}>
        <CustomPropertyHeader
          className="tw:min-w-0 tw:flex-1"
          property={property}
          value={value}
        />
        {isEditing && !meta.isWide && editor}
        {!isEditing && (
          <Box
            align="center"
            className="tw:min-w-0 tw:max-w-3/5"
            gap={3}
            justify="end">
            <Box className="tw:min-w-0">{renderValue()}</Box>
            {canEdit && (
              <ButtonUtility
                color="tertiary"
                data-testid={`edit-${property.name}`}
                icon={Edit02}
                size="xs"
                tooltip={t('label.edit-entity', { entity: label })}
                onClick={() => onEdit(property)}
              />
            )}
          </Box>
        )}
      </Box>
      {isEditing && meta.isWide && editor}
      {isEditing && (
        <Box align="center" gap={2} justify="end">
          <Button
            color="secondary"
            data-testid="inline-cancel-btn"
            isDisabled={isSaving}
            size="sm"
            onPress={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary"
            data-testid="inline-save-btn"
            form={formId}
            isDisabled={!isDirty}
            isLoading={isSaving}
            size="sm"
            type="submit">
            {t('label.save-changes')}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default CustomPropertyRow;
