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
  Card,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Settings02 } from '@openmetadata/ui-core-components/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SORT_OPTIONS } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.constants';
import { CustomPropertySortMode } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.interface';
import { filterAndSortProperties } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import { CustomPropertySearchSortBar } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertySearchSortBar';
import NoDataPlaceholder from '../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import PermissionPlaceholder from '../../../../common/EmptyPlaceholder/PermissionPlaceholder';
import { UserCustomPropertiesProps } from './UserCustomProperties.interface';
import UserCustomPropertyRow from './UserCustomPropertyRow';
import { useUserCustomPropertyAccess } from './useUserCustomPropertyAccess';
import { useUserCustomPropertyEditor } from './useUserCustomPropertyEditor';

/** The user detail's Custom Properties tab: every property, searchable and sortable, edited in place. */
const UserCustomPropertiesList = (props: UserCustomPropertiesProps) => {
  const { t } = useTranslation();
  const access = useUserCustomPropertyAccess(props.user);
  const {
    customProperties,
    isLoading,
    extension,
    editingProperty,
    isSaving,
    startEditing,
    stopEditing,
    saveValue,
  } = useUserCustomPropertyEditor(props);
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<CustomPropertySortMode>('name');
  const visibleProperties = useMemo(
    () =>
      filterAndSortProperties(
        customProperties,
        extension,
        searchText,
        sortMode,
        { groupWideLast: false }
      ),
    [customProperties, extension, searchText, sortMode]
  );

  if (access.isLoading || isLoading || props.isProfileLoading) {
    return (
      <Box data-testid="user-custom-properties-loading" direction="col" gap={2}>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton height={72} key={index} variant="rounded" />
        ))}
      </Box>
    );
  }

  if (!access.canView) {
    return (
      <Box className="tw:relative tw:min-h-80">
        <PermissionPlaceholder
          data-testid="user-custom-properties-no-permission"
          permissionValue={t('label.view-entity', {
            entity: t('label.custom-property-plural'),
          })}
        />
      </Box>
    );
  }

  if (customProperties.length === 0) {
    return (
      <Box className="tw:relative tw:min-h-80">
        <NoDataPlaceholder
          data-testid="user-custom-properties-empty"
          description={t('message.define-user-custom-properties-hint')}
          icon={<Settings02 />}
          title={t('message.no-custom-properties-for-users')}
        />
      </Box>
    );
  }

  return (
    <Box data-testid="user-custom-properties-list" direction="col" gap={4}>
      <CustomPropertySearchSortBar
        searchText={searchText}
        sortMode={sortMode}
        sortOptions={SORT_OPTIONS}
        onSearchChange={setSearchText}
        onSortChange={setSortMode}
      />
      {visibleProperties.length ? (
        <Card
          className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
          variant="muted">
          {visibleProperties.map((property) => (
            <UserCustomPropertyRow
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
        </Card>
      ) : (
        <Typography
          className="tw:py-8 tw:text-center tw:text-tertiary"
          data-testid="no-matching-custom-properties"
          size="text-sm">
          {t('message.no-entity-found-for-name', {
            entity: t('label.property-plural'),
            name: searchText,
          })}
        </Typography>
      )}
    </Box>
  );
};

export default UserCustomPropertiesList;
