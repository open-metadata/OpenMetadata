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

import {
  Box,
  Input,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { SearchLg } from '@openmetadata/ui-core-components/icons';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../../../assets/svg/ic-no-records.svg';
import { CUSTOM_PROPERTIES_DOCS } from '../../../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { CustomProperty } from '../../../../generated/entity/type';
import { buildUpdatedExtension } from '../../../../utils/CustomProperty.utils';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { CustomPropertyListItem } from '../../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertyListItem';
import ErrorPlaceHolderNew from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
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

  const emptyState = useMemo(() => {
    if (searchText) {
      return (
        <Typography
          as="p"
          className="tw:p-2 tw:text-center tw:text-tertiary"
          data-testid="no-matching-custom-properties"
          size="text-sm">
          {t('message.no-entity-found-for-name', {
            entity: t('label.custom-property-plural'),
            name: searchText,
          })}
        </Typography>
      );
    }

    return (
      <div className="lineage-items-list">
        <ErrorPlaceHolderNew
          className="text-grey-14"
          icon={<AddPlaceHolderIcon height={100} width={100} />}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <div className="p-t-md text-justify no-data-placeholder">
            <Tooltip title={t('label.documentation')}>
              <span>
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
              </span>
            </Tooltip>
          </div>
        </ErrorPlaceHolderNew>
      </div>
    );
  }, [searchText, emptyStateMessage]);

  if (isEntityDataLoading) {
    return <Loader size="default" />;
  }

  if (!viewCustomPropertiesPermission) {
    return (
      <div className="lineage-items-list">
        <ErrorPlaceHolderNew
          className="text-grey-14 permission-error-placeholder"
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}>
          <Transi18next
            i18nKey="message.no-access-placeholder"
            renderElement={<span />}
            values={{
              entity: t('label.view-entity', {
                entity: t('label.custom-property-plural'),
              }),
            }}
          />
        </ErrorPlaceHolderNew>
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
        icon={SearchLg}
        inputDataTestId="searchbar"
        placeholder={searchLabel}
        size="sm"
        value={searchText}
        onChange={setSearchText}
      />
      {filteredProperties.length > 0 ? (
        <ul
          className="tw:m-0 tw:list-none tw:divide-y tw:divide-secondary tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-0"
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
