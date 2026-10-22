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
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Edit02,
} from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { Type } from '../../../../../generated/entity/type';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { useAuth } from '../../../../../hooks/authHooks';
import { useSettingsHash } from '../../../../../hooks/useSettingsHash';
import { getTextFromHtmlString } from '../../../../../utils/BlockEditorPureUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { isPropertyValueEmpty } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import { getPropertyRenderer } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyRenderers';
import FieldRow from '../components/FieldRow';
import { viewToSubPath } from '../panels/CustomPropertiesPanel/CustomPropertiesPanel.utils';
import {
  COLLAPSED_ROW_COUNT,
  EMPTY_VALUE,
} from './UserCustomProperties.constants';
import { UserCustomPropertiesProps } from './UserCustomProperties.interface';
import UserCustomPropertyInlineEditor from './UserCustomPropertyInlineEditor';
import { useUserCustomPropertyAccess } from './useUserCustomPropertyAccess';
import { useUserCustomPropertyEditor } from './useUserCustomPropertyEditor';

const CUSTOM_PROPERTIES_NAV_ID = 'custom-properties';

const UserCustomPropertiesSection = (props: UserCustomPropertiesProps) => {
  const { t } = useTranslation();
  const access = useUserCustomPropertyAccess(props.user);
  const { isAdminUser } = useAuth();
  const { setHash } = useSettingsHash();
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    customProperties,
    extension,
    editingProperty,
    isSaving,
    startEditing,
    stopEditing,
    saveValue,
  } = useUserCustomPropertyEditor(props);

  if (!access.canView || customProperties.length === 0) {
    return null;
  }

  // The Custom Properties settings it opens are admin-only, as in classic.
  const canManageFields = Boolean(isAdminUser);
  const visibleProperties = isExpanded
    ? customProperties
    : customProperties.slice(0, COLLAPSED_ROW_COUNT);

  const openManageFields = () =>
    setHash(
      CUSTOM_PROPERTIES_NAV_ID,
      viewToSubPath({
        type: 'detail',
        entityType: { fullyQualifiedName: EntityType.USER } as Type,
      })
    );

  const renderValue = (property: CustomProperty) => {
    const typeName = property.propertyType.name;
    const value = extension?.[property.name];
    if (isPropertyValueEmpty(typeName, value)) {
      return (
        <Typography className="tw:text-tertiary" data-testid="no-value">
          {EMPTY_VALUE}
        </Typography>
      );
    }
    const { View } = getPropertyRenderer(typeName);

    return <View isCompact property={property} value={value} />;
  };

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
        <Typography className="tw:text-secondary" size="text-xs">
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
        {visibleProperties.map((property) =>
          editingProperty?.name === property.name ? (
            <UserCustomPropertyInlineEditor
              isSaving={isSaving}
              key={property.name}
              property={property}
              value={extension?.[property.name]}
              onCancel={stopEditing}
              onSave={saveValue}
            />
          ) : (
            <Box
              align="center"
              className="tw:px-5 tw:py-4"
              data-testid={`custom-property-row-${property.name}`}
              gap={3}
              key={property.name}>
              <div className="tw:min-w-0 tw:flex-1">
                <FieldRow
                  description={getTextFromHtmlString(property.description)}
                  title={getEntityName(property)}>
                  {renderValue(property)}
                </FieldRow>
              </div>
              {access.canEdit && (
                <ButtonUtility
                  color="tertiary"
                  data-testid={`edit-${property.name}`}
                  icon={Edit02}
                  size="xs"
                  tooltip={t('label.edit-entity', {
                    entity: getEntityName(property),
                  })}
                  onClick={() => startEditing(property)}
                />
              )}
            </Box>
          )
        )}
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
