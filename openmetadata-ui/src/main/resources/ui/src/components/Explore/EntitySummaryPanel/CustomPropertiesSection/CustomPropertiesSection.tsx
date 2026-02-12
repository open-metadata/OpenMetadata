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

import { Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../../../assets/svg/ic-no-records.svg';
import { CUSTOM_PROPERTIES_DOCS } from '../../../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { CustomProperty } from '../../../../generated/entity/type';
import { Transi18next } from '../../../../utils/CommonUtils';
import { PropertyValue } from '../../../common/CustomPropertyTable/PropertyValue';
import ErrorPlaceHolderNew from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../../../common/Loader/Loader';
import SearchBarComponent from '../../../common/SearchBarComponent/SearchBar.component';
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

  const customProperties = entityTypeDetail?.customProperties || [];
  const extensionData = (entityData?.extension || {}) as ExtensionDataProps;

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

  const emptyState = useMemo(() => {
    if (searchText) {
      return (
        <Typography.Paragraph className="text-center text-grey-muted p-sm">
          {t('message.no-entity-found-for-name', {
            entity: t('label.custom-property-plural'),
            name: searchText,
          })}
        </Typography.Paragraph>
      );
    }

    return (
      <div className="lineage-items-list empty-state">
        <ErrorPlaceHolderNew
          className="text-grey-14"
          icon={<AddPlaceHolderIcon height={100} width={100} />}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <div className="p-t-md text-justify no-data-placeholder">
            <Transi18next
              i18nKey="message.no-custom-properties-entity"
              renderElement={
                <a
                  href={CUSTOM_PROPERTIES_DOCS}
                  rel="noreferrer"
                  target="_blank"
                  title="Custom properties documentation"
                />
              }
              values={{
                entity: emptyStateMessage ?? t('label.entity'),
                docs: t('label.doc-plural-lowercase'),
              }}
            />
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
      <div className="lineage-items-list empty-state">
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

  return (
    <div className="entity-summary-panel-tab-content custom-properties-section-container">
      <div className="p-x-md p-t-sm">
        <SearchBarComponent
          placeholder={t('label.search-for-type', {
            type: t('label.custom-property'),
          })}
          searchValue={searchText}
          onSearch={setSearchText}
        />
      </div>
      <div className="custom-properties-list p-x-md">
        {filteredProperties.length > 0
          ? filteredProperties.map((property: CustomProperty) => (
            <PropertyValue
              isRenderedInRightPanel
              extension={extensionData}
              hasEditPermissions={hasEditPermissions}
              key={property.name}
              property={property}
              onExtensionUpdate={onExtensionUpdate}
            />
          ))
          : emptyState}
      </div>
    </div>
  );
};

export default CustomPropertiesSection;
