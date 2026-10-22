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
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit02 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { getTextFromHtmlString } from '../../../../../utils/BlockEditorPureUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import {
  HEADER_BADGE_CLASS,
  TYPE_ICON_TILE_CLASS,
} from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.constants';
import {
  getPropertyTypeMeta,
  isPropertyValueEmpty,
} from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import { getPropertyRenderer } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyRenderers';
import { EMPTY_VALUE } from './UserCustomProperties.constants';

interface UserCustomPropertyRowProps {
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
 * One user custom property: type tile, name and type badge on the left, the
 * value on the right. Editing happens in place; Save submits the type's own
 * editor form, so every type keeps its validation and value shape.
 */
const UserCustomPropertyRow = ({
  property,
  value,
  canEdit,
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
}: UserCustomPropertyRowProps) => {
  const { t } = useTranslation();
  const formId = useId();
  const [isDirty, setIsDirty] = useState(false);
  const typeName = property.propertyType.name;
  const meta = getPropertyTypeMeta(typeName);
  const TypeIcon = meta.icon;
  const { View, Edit } = getPropertyRenderer(typeName);
  const label = getEntityName(property);
  const description = getTextFromHtmlString(property.description);

  const editor = (
    <div
      className={classNames(
        'tw:min-w-0',
        meta.isWide ? 'tw:w-full' : 'tw:w-[480px] tw:max-w-full'
      )}>
      <Edit
        formId={formId}
        isSaving={isSaving}
        property={property}
        value={value}
        onDirtyChange={setIsDirty}
        onSave={onSave}
      />
    </div>
  );

  const renderValue = () =>
    isPropertyValueEmpty(typeName, value) ? (
      <Typography className="tw:text-tertiary" data-testid="no-value">
        {EMPTY_VALUE}
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
        <Box align="start" className="tw:min-w-0 tw:flex-1" gap={3}>
          <span
            aria-hidden
            className={`tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border ${
              TYPE_ICON_TILE_CLASS[meta.color]
            }`}>
            <TypeIcon className="tw:size-5" />
          </span>
          <Box className="tw:min-w-0 tw:gap-0.5" direction="col">
            <Box align="center" className="tw:min-h-5" gap={2} wrap="wrap">
              <Typography
                className="tw:text-primary"
                data-testid="property-name"
                size="text-sm"
                weight="semibold">
                {label}
              </Typography>
              <Badge
                className={HEADER_BADGE_CLASS}
                color={meta.color}
                data-testid="property-type-badge"
                size="sm"
                type="color">
                {t(meta.labelKey)}
              </Badge>
            </Box>
            {description && (
              <Typography
                className="tw:line-clamp-2 tw:text-tertiary"
                size="text-xs"
                title={description}>
                {description}
              </Typography>
            )}
          </Box>
        </Box>
        {isEditing && !meta.isWide && editor}
        {!isEditing && (
          <Box
            align="center"
            className="tw:min-w-0 tw:max-w-[60%]"
            gap={3}
            justify="end">
            <div className="tw:min-w-0">{renderValue()}</div>
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

export default UserCustomPropertyRow;
