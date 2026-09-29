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
  FeaturedIcon,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Hint } from '@openmetadata/ui-core-components/icons';
import { Settings02 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import type { Key } from 'react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_PATH } from '../../../../../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../../../../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../enums/permissions.enum';
import { Type } from '../../../../../../generated/entity/type';
import { CustomProperty } from '../../../../../../generated/type/customProperty';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import { getTypeByFQN } from '../../../../../../rest/metadataTypeAPI';
import { getEntityIconWithBg } from '../../../../../../utils/Assets/AssetsUtils';
import globalSettingsClassBase from '../../../../../../utils/GlobalSettingsClassBase';
import { SettingMenuItem } from '../../../../../../utils/GlobalSettingsUtils';
import { userPermissions } from '../../../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import CustomPropertiesAddPage from './CustomPropertiesAddPage';
import CustomPropertiesDetailPage from './CustomPropertiesDetailPage';
import CustomPropertiesEditPage from './CustomPropertiesEditPage';
import CustomPropertiesLandingPage from './CustomPropertiesLandingPage';
import { CRUMB } from './CustomPropertiesPanel.constants';
import { CustomPropertiesSubView } from './CustomPropertiesPanel.types';
import {
  getBreadcrumbItems,
  getPageTitle,
  parseCustomPropertiesHash,
  viewToSubPath,
} from './CustomPropertiesPanel.utils';

interface CustomPropertiesPanelProps {
  onHeaderChange?: (overrides: ProfileHeaderOverride) => void;
}

const HASH_TAB = 'custom-properties';

const CustomPropertiesPanel: React.FC<CustomPropertiesPanelProps> = ({
  onHeaderChange,
}) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { state: hashState, setHash } = useSettingsHash();

  const parsedHash = useMemo(
    () => parseCustomPropertiesHash(hashState.subPath),
    [hashState.subPath]
  );

  const [subView, setSubView] = useState<CustomPropertiesSubView>({
    type: 'landing',
  });
  const [showHint, setShowHint] = useState(false);
  const resolvedFqnRef = useRef<string | null>(null);

  useEffect(() => {
    if (!parsedHash.entityFqn) {
      setSubView({ type: 'landing' });
      resolvedFqnRef.current = null;

      return;
    }

    if (parsedHash.entityFqn === resolvedFqnRef.current) {
      setSubView((prev) => {
        if (prev.type === 'landing') {
          return prev;
        }

        if (parsedHash.action === 'add' && prev.type !== 'add') {
          return { type: 'add', entityType: prev.entityType };
        }

        if (parsedHash.action === 'detail' && prev.type !== 'detail') {
          return { type: 'detail', entityType: prev.entityType };
        }

        return prev;
      });

      return;
    }

    const requestedFqn = parsedHash.entityFqn;
    resolvedFqnRef.current = requestedFqn;
    getTypeByFQN(requestedFqn)
      .then((entityType) => {
        if (resolvedFqnRef.current !== requestedFqn) {
          return;
        }

        if (parsedHash.action === 'add') {
          setSubView({ type: 'add', entityType });
        } else if (parsedHash.action === 'edit' && parsedHash.propertyName) {
          const property = entityType.customProperties?.find(
            (p) => p.name === parsedHash.propertyName
          );

          if (property) {
            setSubView({ type: 'edit', entityType, property });
          } else {
            setSubView({ type: 'detail', entityType });
          }
        } else {
          setSubView({ type: 'detail', entityType });
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
        setHash(HASH_TAB);
      });
  }, [parsedHash, setHash]);

  const handleSelectEntityType = useCallback(
    (entityType: Type) => {
      setHash('custom-properties', entityType.fullyQualifiedName ?? undefined);
    },
    [setHash]
  );

  const handleAddProperty = useCallback(() => {
    setSubView((prev) => {
      if (prev.type === 'detail') {
        const next: CustomPropertiesSubView = {
          type: 'add',
          entityType: prev.entityType,
        };
        setHash(HASH_TAB, viewToSubPath(next));

        return next;
      }

      return prev;
    });
  }, [setHash]);

  const handleEditProperty = useCallback(
    (property: CustomProperty) => {
      setSubView((prev) => {
        if (prev.type === 'detail') {
          const next: CustomPropertiesSubView = {
            type: 'edit',
            entityType: prev.entityType,
            property,
          };
          setHash(HASH_TAB, viewToSubPath(next));

          return next;
        }

        return prev;
      });
    },
    [setHash]
  );

  const handleBackToDetail = useCallback(() => {
    setSubView((prev) => {
      if (prev.type === 'add' || prev.type === 'edit') {
        const next: CustomPropertiesSubView = {
          type: 'detail',
          entityType: prev.entityType,
        };
        setHash(HASH_TAB, viewToSubPath(next));

        return next;
      }

      return prev;
    });
  }, [setHash]);

  const hasTypeViewPermission = userPermissions.hasViewPermissions(
    ResourceEntity.TYPE,
    permissions
  );

  useEffect(() => {
    if (
      subView.type !== 'landing' &&
      Object.keys(permissions).length > 0 &&
      !hasTypeViewPermission
    ) {
      setHash(HASH_TAB);
    }
  }, [subView.type, permissions, hasTypeViewPermission, setHash]);

  const globalSettingsItems = useMemo<SettingMenuItem[]>(() => {
    if (!hasTypeViewPermission) {
      return [];
    }
    const menu = globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
      permissions,
      true
    );
    const customPropsCategory = menu.find(
      (m: SettingMenuItem) =>
        m.key === GlobalSettingsMenuCategory.CUSTOM_PROPERTIES
    );

    return customPropsCategory?.items ?? [];
  }, [permissions, hasTypeViewPermission]);

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
        setHash(HASH_TAB);
      } else if (
        id === CRUMB.DETAIL &&
        (subView.type === 'add' || subView.type === 'edit')
      ) {
        const next: CustomPropertiesSubView = {
          type: 'detail',
          entityType: subView.entityType,
        };
        setSubView(next);
        setHash(HASH_TAB, viewToSubPath(next));
      }
    },
    [subView, setHash]
  );

  // Push dynamic header state (breadcrumbs, icon, actions) up to ProfilePage
  // so ProfileContentHeader reflects the current subView without this panel
  // needing to render its own header.
  useEffect(() => {
    const iconNode =
      subView.type === 'landing' ? (
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
      );

    const actions =
      subView.type === 'add' || subView.type === 'edit' ? (
        <Box align="center" direction="row" gap={2}>
          <Hint className="tw:size-4.5 tw:text-secondary" />
          <Typography size="text-sm" weight="medium">
            {t('label.show-hint')}
          </Typography>
          <Toggle isSelected={showHint} onChange={setShowHint} />
        </Box>
      ) : undefined;

    onHeaderChange?.({
      title: pageTitle,
      description: pageDescription,
      breadcrumbs: breadcrumbItems,
      onBreadcrumbAction: handleBreadcrumbAction,
      iconNode,
      actions,
    });
  }, [
    subView,
    breadcrumbItems,
    handleBreadcrumbAction,
    pageTitle,
    pageDescription,
    showHint,
    t,
    onHeaderChange,
  ]);

  const contentClassName =
    subView.type === 'add' || subView.type === 'edit'
      ? 'tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden'
      : 'tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0';

  return (
    <Box
      className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden"
      direction="col">
      <div className={contentClassName} data-testid="custom-properties-content">
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
