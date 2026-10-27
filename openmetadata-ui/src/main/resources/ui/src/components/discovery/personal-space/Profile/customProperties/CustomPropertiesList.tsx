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
import {
  CustomPropertyEditorOptions,
  useCustomPropertyEditor,
} from '../../../../../hooks/discovery/personal-space/useCustomPropertyEditor';
import { SORT_OPTIONS } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.constants';
import { CustomPropertySortMode } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.interface';
import { filterAndSortProperties } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import { CustomPropertySearchSortBar } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertySearchSortBar';
import NoDataPlaceholder from '../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import PermissionPlaceholder from '../../../../common/EmptyPlaceholder/PermissionPlaceholder';
import CustomPropertyRow from './CustomPropertyRow';

interface CustomPropertiesListProps extends CustomPropertyEditorOptions {
  canView: boolean;
  canEdit: boolean;
  // While true the extension is not known yet, so nothing can be shown or saved.
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** `default` when rendered inside another muted container (cards never nest muted-in-muted). */
  cardVariant?: 'default' | 'muted';
}

/** A settings-modal Custom Properties tab: every property, searchable and sortable, edited in place. */
const CustomPropertiesList = ({
  canView,
  canEdit,
  isLoading: isEntityLoading,
  emptyTitle,
  emptyDescription,
  cardVariant = 'muted',
  ...editorOptions
}: CustomPropertiesListProps) => {
  const { t } = useTranslation();
  const { extension } = editorOptions;
  const {
    customProperties,
    isLoading,
    editingProperty,
    isSaving,
    startEditing,
    stopEditing,
    saveValue,
  } = useCustomPropertyEditor(editorOptions);
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

  if (isEntityLoading || isLoading) {
    return (
      <Box data-testid="custom-properties-loading" direction="col" gap={2}>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton height={72} key={index} variant="rounded" />
        ))}
      </Box>
    );
  }

  if (!canView) {
    return (
      <Box className="tw:relative tw:min-h-80">
        <PermissionPlaceholder
          data-testid="custom-properties-no-permission"
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
          data-testid="custom-properties-empty"
          description={
            emptyDescription ?? t('message.no-custom-properties-defined')
          }
          icon={<Settings02 />}
          title={emptyTitle ?? t('label.no-custom-properties-defined')}
        />
      </Box>
    );
  }

  return (
    <Box data-testid="custom-properties-list" direction="col" gap={4}>
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
          variant={cardVariant}>
          {visibleProperties.map((property) => (
            <CustomPropertyRow
              canEdit={canEdit}
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
          className="tw:py-8 tw:text-center"
          color="secondary"
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

export default CustomPropertiesList;
