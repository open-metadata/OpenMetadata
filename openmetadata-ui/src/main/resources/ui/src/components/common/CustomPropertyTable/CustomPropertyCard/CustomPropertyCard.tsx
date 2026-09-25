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
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit05, Plus } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTextFromHtmlString } from '../../../../utils/BlockEditorPureUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { TYPE_ICON_TILE_CLASS } from './CustomPropertyCard.constants';
import { CustomPropertyCardProps } from './CustomPropertyCard.types';
import {
  getPropertyItemCount,
  getPropertyTypeMeta,
  isPropertyValueEmpty,
} from './CustomPropertyCard.utils';
import { CustomPropertyEditModal } from './CustomPropertyEditModal';
import { getPropertyRenderer } from './CustomPropertyRenderers';

// Design spec: 20px tall header badges (18px line + 1px border each side).
const HEADER_BADGE_CLASS =
  'tw:py-px tw:px-[7px] tw:leading-[18px] tw:font-medium';

export const CustomPropertyCard = ({
  property,
  value,
  hasEditPermissions,
  onValueSave,
}: CustomPropertyCardProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const typeName = property.propertyType.name;
  const meta = getPropertyTypeMeta(typeName);
  const { View, TitleAddon, getEmptyHint } = getPropertyRenderer(typeName);
  const TypeIcon = meta.icon;
  const propertyLabel = getEntityName(property);
  const isEmptyValue = isPropertyValueEmpty(typeName, value);
  const itemCount = getPropertyItemCount(typeName, value);
  const description = property.description
    ? getTextFromHtmlString(property.description)
    : '';

  const startEditing = () => setIsEditing(true);
  const stopEditing = () => setIsEditing(false);

  const handleSave = async (updatedValue: unknown) => {
    setIsSaving(true);
    try {
      await onValueSave(property, updatedValue);
      setIsEditing(false);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  const renderBody = () => {
    if (isEmptyValue) {
      const hint = getEmptyHint?.(property, t);

      return (
        <Box align="center" data-testid="no-data" gap={3} justify="between">
          <Box direction="col">
            <Typography className="tw:text-secondary" size="text-sm">
              {t('label.no-value-yet')}
            </Typography>
            {hint && (
              <Typography className="tw:text-tertiary" size="text-xs">
                {hint}
              </Typography>
            )}
          </Box>
          {hasEditPermissions && (
            <Button
              color="secondary"
              data-testid="edit-icon"
              iconLeading={Plus}
              size="sm"
              onPress={startEditing}>
              {t(meta.emptyActionKey)}
            </Button>
          )}
        </Box>
      );
    }

    return <View property={property} value={value} />;
  };

  return (
    <Card
      className="tw:h-full tw:px-5 tw:py-4"
      data-testid={`custom-property-${property.name}-card`}>
      <Box
        className="tw:h-full"
        data-testid={property.name}
        direction="col"
        gap={4}>
        <Box align="start" gap={3}>
          <span
            aria-hidden
            className={`tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border ${
              TYPE_ICON_TILE_CLASS[meta.color]
            }`}>
            <TypeIcon className="tw:size-5" />
          </span>
          {/* Title (20px) + 2px + subtitle (18px) matches the 40px icon tile. */}
          <Box className="tw:min-w-0 tw:flex-1 tw:gap-0.5" direction="col">
            <Box align="center" className="tw:min-h-5" gap={2} wrap="wrap">
              {/* Plain heading: Typography's prose styles size h3 at 20px. */}
              <h3
                className="tw:m-0 tw:text-sm tw:leading-5 tw:font-semibold tw:text-primary"
                data-testid="property-name">
                {propertyLabel}
              </h3>
              {itemCount !== undefined && (
                <Badge
                  className={HEADER_BADGE_CLASS}
                  color="gray"
                  data-testid="property-item-count"
                  size="sm"
                  type="modern">
                  {itemCount}
                </Badge>
              )}
              <Badge
                className={HEADER_BADGE_CLASS}
                color={meta.color}
                data-testid="property-type-badge"
                size="sm"
                type="color">
                {t(meta.labelKey)}
              </Badge>
              {TitleAddon && !isEmptyValue && (
                <TitleAddon property={property} value={value} />
              )}
            </Box>
            {description && (
              <Typography
                className="tw:line-clamp-2 tw:text-left tw:leading-[18px] tw:text-tertiary"
                size="text-xs"
                title={description}>
                {description}
              </Typography>
            )}
          </Box>
          {hasEditPermissions && !isEmptyValue && (
            <ButtonUtility
              color="secondary"
              data-testid="edit-icon"
              icon={Edit05}
              size="xs"
              tooltip={t('label.edit-entity', { entity: propertyLabel })}
              onClick={startEditing}
            />
          )}
        </Box>
        <div className="tw:min-w-0" data-testid="property-value">
          {renderBody()}
        </div>
      </Box>
      {isEditing && (
        <CustomPropertyEditModal
          isNewValue={isEmptyValue}
          isSaving={isSaving}
          property={property}
          value={value}
          onCancel={stopEditing}
          onSave={handleSave}
        />
      )}
    </Card>
  );
};
