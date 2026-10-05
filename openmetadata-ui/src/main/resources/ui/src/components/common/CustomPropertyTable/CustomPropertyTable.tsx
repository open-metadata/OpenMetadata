/*
 *  Copyright 2022 Collate.
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

import { SkeletonParagraph } from '@openmetadata/ui-core-components';
import { GridDotsOuter } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CUSTOM_PROPERTIES_DOCS } from '../../../constants/docs.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../../enums/entity.enum';
import { ChangeDescription } from '../../../generated/entity/type';
import { useEntityTypeCustomProperties } from '../../../hooks/useEntityTypeCustomProperties';
import {
  getChangedEntityNewValue,
  getDiffByFieldName,
} from '../../../utils/EntityDiffPureUtils';
import { getUpdatedExtensionDiffFields } from '../../../utils/EntityDiffUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { resolveWidgetKey } from '../../DataAssets/CommonWidgets/CommonWidgets.utils';
import CreatePlaceholder from '../EmptyPlaceholder/CreatePlaceholder';
import ErrorPlaceHolder from '../ErrorWithPlaceholder/ErrorPlaceHolder';
import { CustomPropertiesRightPanel } from './CustomPropertiesWidget/CustomPropertiesRightPanel';
import {
  parsePropertyLayout,
  selectWidgetProperties,
} from './CustomPropertiesWidget/CustomPropertiesWidget.utils';
import { CustomPropertyCardList } from './CustomPropertyCard/CustomPropertyCardList';
import { CustomPropertyVersionList } from './CustomPropertyCard/CustomPropertyVersionList';
import {
  CustomPropertyProps,
  ExtentionEntities,
  ExtentionEntitiesKeys,
} from './CustomPropertyTable.interface';
import { useCustomPropertyValueSave } from './useCustomPropertyValueSave';

export const CustomPropertyTable = <T extends ExtentionEntitiesKeys>({
  entityType,
  hasEditAccess,
  isVersionView,
  hasPermission,
  maxDataCap,
  isRenderedInRightPanel = false,
  widgetSettings,
  widgetKey = DetailPageWidgetKeys.CUSTOM_PROPERTIES,
}: CustomPropertyProps<T>) => {
  const { t } = useTranslation();
  const {
    data: entityDetails,
    filterWidgets,
    layout,
  } = useGenericContext<ExtentionEntities[T]>();
  const tabPropertyLayout = useMemo(
    () =>
      parsePropertyLayout(
        layout?.find((widget) =>
          resolveWidgetKey(widget.i, [DetailPageWidgetKeys.CUSTOM_PROPERTIES])
        )?.config?.propertyLayout
      ),
    [layout]
  );
  const {
    customProperties,
    isLoading: entityTypeDetailLoading,
    error: entityTypeDetailError,
  } = useEntityTypeCustomProperties(entityType);
  const { onPropertyValueSave } =
    useCustomPropertyValueSave<ExtentionEntities[T]>();

  useEffect(() => {
    if (entityTypeDetailError) {
      showErrorToast(entityTypeDetailError as AxiosError);
    }
  }, [entityTypeDetailError]);

  const extensionObject: {
    extensionObject?: Record<string, unknown>;
    addedKeysList?: string[];
  } = useMemo(() => {
    if (isVersionView) {
      const changeDescription = entityDetails?.changeDescription;
      const extensionDiff = getDiffByFieldName(
        EntityField.EXTENSION,
        changeDescription as ChangeDescription
      );

      const newValues = getChangedEntityNewValue(extensionDiff);

      if (extensionDiff.added) {
        const addedFields = JSON.parse(newValues ?? [])[0];
        if (addedFields) {
          return {
            extensionObject: entityDetails?.extension,
            addedKeysList: Object.keys(addedFields),
          };
        }
      }

      if (entityDetails && extensionDiff.updated) {
        return getUpdatedExtensionDiffFields(entityDetails, extensionDiff);
      }
    }

    return { extensionObject: entityDetails?.extension };
  }, [isVersionView, entityDetails?.extension]);

  const dataSource = useMemo(
    () =>
      isRenderedInRightPanel && widgetSettings
        ? selectWidgetProperties(customProperties, widgetSettings)
        : customProperties.slice(0, maxDataCap),
    [maxDataCap, customProperties, isRenderedInRightPanel, widgetSettings]
  );

  const viewAllPath = useMemo(() => {
    const hasHiddenProperties = widgetSettings
      ? dataSource.length < customProperties.length
      : Boolean(maxDataCap && customProperties.length >= maxDataCap);

    return hasHiddenProperties && entityDetails?.fullyQualifiedName
      ? entityUtilClassBase.getEntityLink(
          entityType,
          entityDetails.fullyQualifiedName,
          EntityTabs.CUSTOM_PROPERTIES
        )
      : undefined;
  }, [
    customProperties,
    dataSource,
    entityType,
    entityDetails,
    maxDataCap,
    widgetSettings,
  ]);

  useEffect(() => {
    const hasNothingToShow = widgetSettings
      ? isEmpty(dataSource)
      : isEmpty(customProperties) && isUndefined(entityDetails?.extension);

    if (
      isRenderedInRightPanel &&
      !entityTypeDetailLoading &&
      hasNothingToShow
    ) {
      filterWidgets?.([widgetKey]);
    }
  }, [
    isRenderedInRightPanel,
    customProperties,
    dataSource,
    entityTypeDetailLoading,
    widgetKey,
  ]);

  if (entityTypeDetailLoading) {
    return (
      <div
        className="p-lg border-default border-radius-sm"
        data-testid="custom-property-table-loader">
        <SkeletonParagraph className="tw:mb-3.5" />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="items-center d-block align-items-center text-center">
        <ErrorPlaceHolder
          className="border-none p-lg"
          permissionValue={t('label.view-entity', {
            entity: t('label.custom-property-plural'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      </div>
    );
  }

  if (
    isEmpty(customProperties) &&
    isUndefined(entityDetails?.extension) &&
    // in case of right panel, we don't want to show the placeholder
    !isRenderedInRightPanel
  ) {
    return (
      <div className="h-full tw:relative tw:min-h-90">
        <CreatePlaceholder
          actions={[
            {
              key: 'read-docs',
              id: 'custom-property-read-docs',
              label: t('label.read-type', { type: t('label.doc-plural') }),
              color: 'primary',
              onPress: () =>
                window.open(CUSTOM_PROPERTIES_DOCS, '_blank', 'noreferrer'),
            },
          ]}
          description={t('message.custom-property-empty-description', {
            entity: startCase(entityType).toLowerCase(),
          })}
          icon={<GridDotsOuter className="tw:text-utility-brand-600" />}
          title={t('label.no-custom-properties-defined')}
        />
      </div>
    );
  }

  if (isRenderedInRightPanel) {
    // dataSource is empty exactly when there is nothing to list
    if (isEmpty(dataSource)) {
      return null;
    }

    return (
      <CustomPropertiesRightPanel
        extension={extensionObject.extensionObject}
        hasEditPermissions={hasEditAccess}
        properties={dataSource}
        viewAllPath={viewAllPath}
        widgetSettings={widgetSettings}
        onValueSave={onPropertyValueSave}
      />
    );
  }

  if (isEmpty(customProperties)) {
    return null;
  }

  if (isVersionView) {
    return (
      <CustomPropertyVersionList
        addedKeys={extensionObject.addedKeysList}
        extension={extensionObject.extensionObject}
        properties={dataSource}
      />
    );
  }

  return (
    <CustomPropertyCardList
      extension={extensionObject.extensionObject}
      hasEditPermissions={hasEditAccess}
      properties={dataSource}
      propertyLayout={tabPropertyLayout}
      onValueSave={onPropertyValueSave}
    />
  );
};
