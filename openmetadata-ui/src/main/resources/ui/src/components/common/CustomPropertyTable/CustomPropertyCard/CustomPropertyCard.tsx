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
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { WidgetEditButton } from '../../WidgetActionButton/WidgetActionButton';
import { COMPACT_CARD_CLASS } from './CustomPropertyCard.constants';
import { CustomPropertyCardProps } from './CustomPropertyCard.interface';
import {
  getPropertyTypeMeta,
  isPropertyValueEmpty,
} from './CustomPropertyCard.utils';
import { CustomPropertyEditModal } from './CustomPropertyEditModal';
import { CustomPropertyHeader } from './CustomPropertyHeader';
import { getPropertyRenderer } from './CustomPropertyRenderers';

export const CustomPropertyCard = ({
  isCompact = false,
  headerActions,
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
  const { View, getEmptyHint } = getPropertyRenderer(typeName);
  const propertyLabel = getEntityName(property);
  const isEmptyValue = isPropertyValueEmpty(typeName, value);

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
        <Box align="center" gap={3} justify="between">
          <Box className="tw:min-w-0" data-testid="no-data" direction="col">
            <Typography className="tw:text-secondary" size="text-sm">
              {t('label.no-value-yet')}
            </Typography>
            {hint && (
              <Typography
                className={classNames('tw:text-tertiary', {
                  'tw:truncate': isCompact,
                })}
                size="text-xs">
                {hint}
              </Typography>
            )}
          </Box>
          {hasEditPermissions && (
            <Button
              className="tw:shrink-0"
              color="secondary"
              data-testid="add-value-button"
              iconLeading={Plus}
              size="sm"
              onPress={startEditing}>
              {t(meta.emptyActionLabelKey)}
            </Button>
          )}
        </Box>
      );
    }

    return <View isCompact={isCompact} property={property} value={value} />;
  };

  return (
    <Card
      className={classNames('tw:px-5 tw:py-4', {
        [COMPACT_CARD_CLASS]: isCompact,
      })}
      data-testid={`custom-property-${property.name}-card`}
      variant="elevated">
      <Box
        className="tw:h-full"
        data-testid={property.name}
        direction="col"
        gap={4}>
        <Box align="start" gap={3}>
          <CustomPropertyHeader
            className="tw:min-w-0 tw:flex-1"
            isCompact={isCompact}
            property={property}
            value={value}
          />
          {hasEditPermissions && !isEmptyValue && (
            <WidgetEditButton
              data-testid="edit-icon"
              title={t('label.edit-entity', { entity: propertyLabel })}
              onClick={startEditing}
            />
          )}
          {headerActions}
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
