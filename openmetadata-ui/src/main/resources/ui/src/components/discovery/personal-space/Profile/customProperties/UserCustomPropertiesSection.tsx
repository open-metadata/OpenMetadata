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
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from '@openmetadata/ui-core-components/icons';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { useAuth } from '../../../../../hooks/authHooks';
import { useCustomPropertyEditor } from '../../../../../hooks/discovery/personal-space/useCustomPropertyEditor';
import { useUserCustomPropertyAccess } from '../../../../../hooks/discovery/personal-space/useUserCustomPropertyAccess';
import { useSettingsHash } from '../../../../../hooks/useSettingsHash';
import { entityTypeDetailSubPath } from '../tabs/custom-properties/CustomPropertiesPanel.utils';
import CustomPropertyRow from './CustomPropertyRow';
import { COLLAPSED_ROW_COUNT } from './UserCustomProperties.constants';
import { UserCustomPropertiesProps } from './UserCustomProperties.types';

const CUSTOM_PROPERTIES_NAV_ID = 'custom-properties';

const UserCustomPropertiesSection = ({
  user,
  onUpdate,
}: UserCustomPropertiesProps) => {
  const { t } = useTranslation();
  const access = useUserCustomPropertyAccess(user);
  const { isAdminUser } = useAuth();
  const { setHash } = useSettingsHash();
  const [isExpanded, setIsExpanded] = useState(false);
  const extension = user.extension as Record<string, unknown> | undefined;
  const saveExtension = useCallback(
    (nextExtension: Record<string, unknown> | undefined) =>
      onUpdate({ extension: nextExtension }, 'extension'),
    [onUpdate]
  );
  const {
    customProperties,
    editingProperty,
    isSaving,
    startEditing,
    stopEditing,
    saveValue,
  } = useCustomPropertyEditor({
    entityType: EntityType.USER,
    extension,
    onUpdate: saveExtension,
  });

  if (!access.canView || customProperties.length === 0) {
    return null;
  }

  // The Custom Properties settings it opens are admin-only, as in classic.
  const canManageFields = Boolean(isAdminUser);
  const visibleProperties = isExpanded
    ? customProperties
    : customProperties.slice(0, COLLAPSED_ROW_COUNT);

  const openManageFields = () =>
    setHash(CUSTOM_PROPERTIES_NAV_ID, entityTypeDetailSubPath(EntityType.USER));

  return (
    <Box
      data-testid="profile-section-custom-properties"
      direction="col"
      gap={3}>
      <Box align="center" className="tw:px-1" gap={2}>
        <Typography
          className="tw:text-primary tw:uppercase"
          size="text-xs"
          weight="medium">
          {t('label.custom-property-plural')}
        </Typography>
        <Typography color="secondary" size="text-xs">
          {t('message.custom-properties-additional-details')}
        </Typography>
        {canManageFields && (
          <Button
            className="tw:ml-auto"
            color="link-color"
            data-testid="manage-custom-properties"
            iconTrailing={ArrowUpRight}
            size="sm"
            onPress={openManageFields}>
            {t('label.manage-fields')}
          </Button>
        )}
      </Box>
      <Card
        className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
        variant="muted">
        {visibleProperties.map((property) => (
          <CustomPropertyRow
            canEdit={access.canEdit}
            isEditing={editingProperty?.name === property.name}
            isSaving={isSaving}
            key={property.name}
            property={property}
            value={extension?.[property.name]}
            onCancel={stopEditing}
            onEdit={startEditing}
            onSave={saveValue}
          />
        ))}
        {customProperties.length > COLLAPSED_ROW_COUNT && (
          <Box className="tw:px-5 tw:py-3.5">
            <Button
              color="link-color"
              data-testid="toggle-all-custom-properties"
              iconTrailing={isExpanded ? ChevronUp : ChevronDown}
              size="md"
              onPress={() => setIsExpanded((expanded) => !expanded)}>
              {isExpanded
                ? t('label.show-less-lowercase')
                : t('label.show-all-count', { count: customProperties.length })}
            </Button>
          </Box>
        )}
      </Card>
    </Box>
  );
};

export default UserCustomPropertiesSection;
