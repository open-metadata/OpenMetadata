/*
 *  Copyright 2025 Collate.
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

import { Box, Input } from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CUSTOM_PROPERTIES_DOCS } from '../../../../constants/docs.constants';
import { CustomProperty } from '../../../../generated/entity/type';
import { buildUpdatedExtension } from '../../../../utils/CustomProperty.utils';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { CustomPropertyListItem } from '../../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertyListItem';
import PanelEmptyPlaceholder from '../../../common/EmptyPlaceholder/PanelEmptyPlaceholder';
import PermissionPlaceholder from '../../../common/EmptyPlaceholder/PermissionPlaceholder';
import Loader from '../../../common/Loader/Loader';
import { ExtensionDataProps } from '../../../Modals/ModalWithCustomProperty/ModalWithMarkdownEditor.interface';
import { CustomPropertiesSectionProps } from './CustomPropertiesSection.interface';
import './CustomPropertiesSection.less';

const CustomPropertiesSection = ({
  entityData,
  entityTypeDetail,
  emptyStateMessage,
  onExtensionUpdate,
  hasEditPermissions,
  isEntityDataLoading,
  viewCustomPropertiesPermission,
}: CustomPropertiesSectionProps) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState<string>('');

  const customProperties = useMemo(
    () => entityTypeDetail?.customProperties ?? [],
    [entityTypeDetail?.customProperties]
  );
  const extensionData = useMemo(
    () => (entityData?.extension ?? {}) as ExtensionDataProps,
    [entityData?.extension]
  );

  const filteredProperties = useMemo(() => {
    if (!searchText) {
      return customProperties;
    }

    const searchLower = searchText.toLowerCase();

    return customProperties.filter((property: CustomProperty) => {
      const propertyName = property.name?.toLowerCase() || '';
      const propertyDisplayName = property.displayName?.toLowerCase() || '';
      const propertyType = property.propertyType?.name?.toLowerCase() || '';

      return (
        propertyName.includes(searchLower) ||
        propertyDisplayName.includes(searchLower) ||
        propertyType.includes(searchLower)
      );
    });
  }, [customProperties, searchText]);

  const handleValueSave = useCallback(
    (property: CustomProperty, value: unknown) =>
      onExtensionUpdate(
        buildUpdatedExtension(
          extensionData,
          property.name,
          property.propertyType.name ?? '',
          value
        )
      ),
    [extensionData, onExtensionUpdate]
  );

  const emptyState = useMemo(
    () => (
      <div className="lineage-items-list tw:min-w-0 tw:px-4">
        <PanelEmptyPlaceholder
          description={
            <Transi18next
              i18nKey="message.no-custom-properties-entity"
              renderElement={
                <a
                  aria-label={t('label.documentation')}
                  href={CUSTOM_PROPERTIES_DOCS}
                  rel="noreferrer"
                  target="_blank"
                />
              }
              values={{
                entity: emptyStateMessage ?? t('label.entity'),
                docs: t('label.doc-plural-lowercase'),
              }}
            />
          }
          searchResultsTestId="no-matching-custom-properties"
          searchText={searchText}
        />
      </div>
    ),
    [searchText, emptyStateMessage, t]
  );

  if (isEntityDataLoading) {
    return <Loader size="default" />;
  }

  if (!viewCustomPropertiesPermission) {
    return (
      <div className="lineage-items-list">
        <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
          <PermissionPlaceholder data-testid="permission-error-placeholder" />
        </div>
      </div>
    );
  }

  if (!customProperties.length && !searchText) {
    return emptyState;
  }

  const searchLabel = t('label.search-for-type', {
    type: t('label.custom-property'),
  });

  return (
    <Box
      className="entity-summary-panel-tab-content custom-properties-section-container tw:p-4"
      direction="col"
      gap={3}>
      <Input
        aria-label={searchLabel}
        icon={Search}
        inputDataTestId="searchbar"
        placeholder={searchLabel}
        size="sm"
        value={searchText}
        onChange={setSearchText}
      />
      {filteredProperties.length > 0 ? (
        <ul
          className="tw:m-0 tw:list-none tw:divide-y tw:divide-secondary tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:p-0"
          data-testid="custom-properties-list">
          {filteredProperties.map((property: CustomProperty) => (
            <CustomPropertyListItem
              hasEditPermissions={hasEditPermissions}
              key={property.name}
              property={property}
              value={extensionData[property.name]}
              onValueSave={handleValueSave}
            />
          ))}
        </ul>
      ) : (
        emptyState
      )}
    </Box>
  );
};

export default CustomPropertiesSection;
