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
  Breadcrumbs,
  FeaturedIcon,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Hint } from '@openmetadata/ui-core-components/icons';
import { Settings02 } from '@untitledui/icons';
import type { Key } from 'react';
import React, { useCallback, useMemo, useState } from 'react';
import { TFunction, useTranslation } from 'react-i18next';
import { ENTITY_PATH } from '../../../../../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../../../../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { Type } from '../../../../../../generated/entity/type';
import { CustomProperty } from '../../../../../../generated/type/customProperty';
import { useAuth } from '../../../../../../hooks/authHooks';
import { getEntityIconWithBg } from '../../../../../../utils/Assets/AssetsUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import globalSettingsClassBase from '../../../../../../utils/GlobalSettingsClassBase';
import { SettingMenuItem } from '../../../../../../utils/GlobalSettingsUtils';
import CustomPropertiesAddPage from './CustomPropertiesAddPage';
import CustomPropertiesDetailPage from './CustomPropertiesDetailPage';
import CustomPropertiesEditPage from './CustomPropertiesEditPage';
import CustomPropertiesLandingPage from './CustomPropertiesLandingPage';
import { CustomPropertiesSubView } from './CustomPropertiesPanel.types';

const CRUMB = {
  WORKSPACE: 'workspace',
  LANDING: 'landing',
  DETAIL: 'detail',
  ACTION: 'action',
} as const;

function getBreadcrumbItems(
  subView: CustomPropertiesSubView,
  t: TFunction,
  matchingSettingsItem: SettingMenuItem | undefined
): { id: string; label: string }[] {
  const base = [
    { id: CRUMB.WORKSPACE, label: t('label.workspace') },
    { id: CRUMB.LANDING, label: t('label.custom-property-plural') },
  ];

  if (subView.type === 'detail') {
    const entityLabel =
      matchingSettingsItem?.label ?? getEntityName(subView.entityType);

    return [...base, { id: CRUMB.DETAIL, label: entityLabel }];
  }

  if (subView.type === 'add') {
    const entityLabel =
      matchingSettingsItem?.label ?? getEntityName(subView.entityType);

    return [
      ...base,
      { id: CRUMB.DETAIL, label: entityLabel },
      {
        id: CRUMB.ACTION,
        label: t('label.add-entity', { entity: t('label.custom-property') }),
      },
    ];
  }

  if (subView.type === 'edit') {
    const entityLabel =
      matchingSettingsItem?.label ?? getEntityName(subView.entityType);

    return [
      ...base,
      { id: CRUMB.DETAIL, label: entityLabel },
      { id: CRUMB.ACTION, label: getEntityName(subView.property) },
    ];
  }

  return base;
}

function getPageTitle(
  subView: CustomPropertiesSubView,
  t: TFunction,
  matchingSettingsItem: SettingMenuItem | undefined
): string {
  if (subView.type === 'detail') {
    return matchingSettingsItem?.label ?? getEntityName(subView.entityType);
  }
  if (subView.type === 'add') {
    return t('label.add-entity', { entity: t('label.custom-property') });
  }
  if (subView.type === 'edit') {
    return getEntityName(subView.property);
  }

  return t('label.custom-property-plural');
}

function getContentClassName(subView: CustomPropertiesSubView): string {
  return subView.type === 'add' || subView.type === 'edit'
    ? 'tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden'
    : 'tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0';
}

const CustomPropertiesPanel: React.FC = () => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { isAdminUser } = useAuth();
  const [subView, setSubView] = useState<CustomPropertiesSubView>({
    type: 'landing',
  });
  const [showHint, setShowHint] = useState(false);

  const handleSelectEntityType = useCallback((entityType: Type) => {
    setSubView({ type: 'detail', entityType });
  }, []);

  const handleAddProperty = useCallback(() => {
    setSubView((prev) => {
      if (prev.type === 'detail') {
        return { type: 'add', entityType: prev.entityType };
      }

      return prev;
    });
  }, []);

  const handleEditProperty = useCallback((property: CustomProperty) => {
    setSubView((prev) => {
      if (prev.type === 'detail') {
        return { type: 'edit', entityType: prev.entityType, property };
      }

      return prev;
    });
  }, []);

  const handleBackToDetail = useCallback(() => {
    setSubView((prev) => {
      if (prev.type === 'add' || prev.type === 'edit') {
        return { type: 'detail', entityType: prev.entityType };
      }

      return prev;
    });
  }, []);

  const globalSettingsItems = useMemo<SettingMenuItem[]>(() => {
    const menu = globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
      permissions,
      isAdminUser
    );
    const customPropsCategory = menu.find(
      (m: SettingMenuItem) =>
        m.key === GlobalSettingsMenuCategory.CUSTOM_PROPERTIES
    );

    return (customPropsCategory?.items ?? []).filter(
      (item: SettingMenuItem) => item.isProtected
    );
  }, [permissions, isAdminUser]);

  const matchingSettingsItem = useMemo<SettingMenuItem | undefined>(() => {
    if (subView.type === 'landing') {
      return undefined;
    }
    const entityFqn = subView.entityType.fullyQualifiedName;

    return globalSettingsItems.find((item) => {
      const optionKey = item.key.split('.')[1] as keyof typeof ENTITY_PATH;

      return (ENTITY_PATH[optionKey] ?? optionKey) === entityFqn;
    });
  }, [subView, globalSettingsItems]);

  const breadcrumbItems = useMemo(
    () => getBreadcrumbItems(subView, t, matchingSettingsItem),
    [subView, t, matchingSettingsItem]
  );

  const pageTitle = useMemo(
    () => getPageTitle(subView, t, matchingSettingsItem),
    [subView, t, matchingSettingsItem]
  );

  const pageDescription = useMemo(() => {
    if (subView.type !== 'landing') {
      return (
        matchingSettingsItem?.description ??
        subView.entityType.description ??
        ''
      );
    }

    return t('message.custom-properties-settings-description');
  }, [subView, t, matchingSettingsItem]);

  const handleBreadcrumbAction = useCallback(
    (id: Key) => {
      if (id === CRUMB.WORKSPACE || id === CRUMB.LANDING) {
        setSubView({ type: 'landing' });
      } else if (
        id === CRUMB.DETAIL &&
        (subView.type === 'add' || subView.type === 'edit')
      ) {
        setSubView({ type: 'detail', entityType: subView.entityType });
      }
    },
    [subView]
  );

  return (
    <Box
      className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden"
      direction="col">
      {/* Managed header — mirrors ProfileContentHeader layout */}
      <Box
        className="ai-profile-page__content-header tw:mb-7 tw:shrink-0 tw:border-b tw:border-utility-gray-200 tw:px-6 tw:py-4"
        data-testid="custom-properties-header"
        direction="col"
        gap={3}>
        <Breadcrumbs
          divider="chevron"
          items={breadcrumbItems}
          size="xs"
          type="text"
          onAction={handleBreadcrumbAction}
        />
        <Box align="center" direction="row" justify="between">
          <Box align="center" direction="row" gap={3}>
            {subView.type === 'landing' ? (
              <FeaturedIcon
                className="tw:rounded-xl"
                color="brand"
                icon={Settings02}
                shape="square"
                size="md"
                theme="dark"
              />
            ) : (
              getEntityIconWithBg(
                subView.entityType.fullyQualifiedName ?? '',
                { className: 'tw:h-10 tw:w-10 tw:rounded-lg' },
                { size: 25 }
              )
            )}
            <Box direction="col">
              <Typography
                className="tw:text-primary-900"
                size="text-lg"
                weight="bold">
                {pageTitle}
              </Typography>
              <Typography
                className="tw:text-tertiary"
                size="text-sm"
                weight="regular">
                {pageDescription}
              </Typography>
            </Box>
          </Box>

          {(subView.type === 'add' || subView.type === 'edit') && (
            <Box align="center" direction="row" gap={2}>
              <Hint className="tw:size-4.5 tw:text-secondary" />
              <Typography size="text-sm" weight="medium">
                {t('label.show-hint')}
              </Typography>
              <Toggle isSelected={showHint} onChange={setShowHint} />
            </Box>
          )}
        </Box>
      </Box>

      {/* Content body */}
      <div
        className={getContentClassName(subView)}
        data-testid="custom-properties-content">
        {subView.type === 'landing' && (
          <CustomPropertiesLandingPage
            onSelectEntityType={handleSelectEntityType}
          />
        )}
        {subView.type === 'detail' && (
          <CustomPropertiesDetailPage
            entityType={subView.entityType}
            onAddProperty={handleAddProperty}
            onEditProperty={handleEditProperty}
          />
        )}
        {subView.type === 'add' && (
          <CustomPropertiesAddPage
            entityType={subView.entityType}
            showHint={showHint}
            onCancel={handleBackToDetail}
            onSuccess={handleBackToDetail}
          />
        )}
        {subView.type === 'edit' && (
          <CustomPropertiesEditPage
            entityType={subView.entityType}
            property={subView.property}
            showHint={showHint}
            onCancel={handleBackToDetail}
            onSuccess={handleBackToDetail}
          />
        )}
      </div>
    </Box>
  );
};

export default CustomPropertiesPanel;
