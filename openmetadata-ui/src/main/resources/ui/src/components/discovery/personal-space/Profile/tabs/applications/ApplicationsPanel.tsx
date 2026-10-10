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

import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import { Box, EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { GridView, Lock01 } from '@openmetadata/ui-core-components/icons';
import type { Key } from 'react';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../../../../hooks/authHooks';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import AppDetail from './AppDetail';
import { AppFooterSlotContext } from './AppFooter';
import AppInstall from './AppInstall';
import type {
  ApplicationsHeader,
  ApplicationsView,
} from './Applications.types';
import {
  APPLICATIONS_HASH_TAB,
  hashSubPathToView,
  viewToSubPath,
} from './Applications.utils';
import ApplicationsList from './ApplicationsList';
import MarketplaceAppDetail from './MarketplaceAppDetail';
import MarketplaceList from './MarketplaceList';

const CRUMB_MARKETPLACE = 'marketplace-crumb';
const CRUMB_APP = 'marketplace-app';
const VIEW_INSTALL = 'install';
const VIEW_MARKETPLACE = 'marketplace';
const VIEW_MARKETPLACE_DETAIL = 'marketplace-detail';
const MARKETPLACE_VIEWS: ReadonlySet<ApplicationsView['type']> = new Set([
  VIEW_MARKETPLACE,
  VIEW_MARKETPLACE_DETAIL,
  VIEW_INSTALL,
]);

interface ApplicationsPanelProps {
  onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
}

const ApplicationsPanel: FC<ApplicationsPanelProps> = ({ onHeaderChange }) => {
  const { t } = useTranslation();
  const { state: hashState, setHash } = useSettingsHash();
  const { isAdminUser } = useAuth();

  const view = useMemo<ApplicationsView>(
    () => hashSubPathToView(hashState.subPath),
    [hashState.subPath]
  );

  const onNavigate = useCallback(
    (next: ApplicationsView) =>
      setHash(APPLICATIONS_HASH_TAB, viewToSubPath(next)),
    [setHash]
  );

  const handleHeaderChange = useCallback(
    ({ crumb, ...header }: ApplicationsHeader) => {
      const appsLabel = t('label.application-plural');
      const isMarketplaceView = MARKETPLACE_VIEWS.has(view.type);

      const breadcrumbs: BreadcrumbItemType[] = [
        { id: 'settings', label: t('label.setting-plural') },
        { id: APPLICATIONS_HASH_TAB, label: appsLabel },
      ];
      if (isMarketplaceView) {
        breadcrumbs.push({
          id: CRUMB_MARKETPLACE,
          label: t('label.market-place'),
        });
      }
      if (view.type === VIEW_INSTALL) {
        breadcrumbs.push({ id: CRUMB_APP, label: crumb ?? '' });
      }
      if (view.type !== 'list' && view.type !== VIEW_MARKETPLACE) {
        breadcrumbs.push({
          id: 'current',
          label: view.type === VIEW_INSTALL ? t('label.install') : crumb ?? '',
        });
      }

      const onBreadcrumbAction = (id: Key) => {
        if (id === APPLICATIONS_HASH_TAB) {
          onNavigate({ type: 'list' });
        } else if (id === CRUMB_MARKETPLACE) {
          onNavigate({ type: VIEW_MARKETPLACE });
        } else if (id === CRUMB_APP && view.type === VIEW_INSTALL) {
          onNavigate({ type: VIEW_MARKETPLACE_DETAIL, fqn: view.fqn });
        }
      };

      onHeaderChange?.({
        title: appsLabel,
        description: t('message.application-settings-description'),
        icon: GridView,
        ...header,
        breadcrumbs,
        onBreadcrumbAction,
      });
    },
    [onHeaderChange, onNavigate, t, view]
  );

  const [footerSlot, setFooterSlot] = useState<HTMLDivElement | null>(null);
  const viewProps = { onNavigate, onHeaderChange: handleHeaderChange };

  const content = (() => {
    // The marketplace and install flow are admin-only, as on the legacy routes.
    if (MARKETPLACE_VIEWS.has(view.type) && !isAdminUser) {
      return (
        <Box className="tw:relative tw:min-h-90 tw:mx-8">
          <EmptyPlaceholder
            data-testid="app-no-permission"
            icon={Lock01}
            title={t('message.no-permission-to-view')}
          />
        </Box>
      );
    }

    switch (view.type) {
      case VIEW_MARKETPLACE:
        return <MarketplaceList {...viewProps} />;
      case VIEW_MARKETPLACE_DETAIL:
        return <MarketplaceAppDetail fqn={view.fqn} {...viewProps} />;
      case VIEW_INSTALL:
        return <AppInstall fqn={view.fqn} {...viewProps} />;
      case 'detail':
        return <AppDetail fqn={view.fqn} {...viewProps} />;
      default:
        return <ApplicationsList {...viewProps} />;
    }
  })();

  return (
    <AppFooterSlotContext.Provider value={footerSlot}>
      <Box
        className="tw:min-h-0 tw:flex-1"
        data-testid="applications-panel"
        direction="col">
        <Box
          className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto"
          direction="col">
          {/* Keyed so switching apps remounts the view and drops stale state. */}
          <Box
            direction="col"
            key={`${view.type}-${'fqn' in view ? view.fqn : ''}`}>
            {content}
          </Box>
        </Box>
        {/* Views portal their actions here; hidden while no view uses it. */}
        <Box
          className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-8 tw:py-4 tw:empty:hidden"
          data-testid="applications-footer"
          direction="col"
          ref={setFooterSlot}
        />
      </Box>
    </AppFooterSlotContext.Provider>
  );
};

export default ApplicationsPanel;
