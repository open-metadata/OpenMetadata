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

import { Box, Toggle, Typography } from '@openmetadata/ui-core-components';
import { Hint, Sliders02 } from '@openmetadata/ui-core-components/icons';
import type { Key, ReactNode } from 'react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import GlossarySettings from '../../../../../governance/glossary/GlossarySettings';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import AppModeSettings from './AppModeSettings';
import AppModeSettingsForm from './AppModeSettingsForm';
import BrandUrlSettings from './BrandUrlSettings';
import BrandUrlSettingsForm from './BrandUrlSettingsForm';
import DataAssetRulesSettings from './DataAssetRulesSettings';
import DataQualitySettings from './DataQualitySettings';
import DimensionSettingsForm from './DimensionSettingsForm';
import EmailSettings from './EmailSettings';
import EmailSettingsForm from './EmailSettingsForm';
import HealthCheckSettings from './HealthCheckSettings';
import LearningResourceSettingsForm from './LearningResourceSettingsForm';
import LearningResourcesSettings from './LearningResourcesSettings';
import LineageSettings from './LineageSettings';
import LineageSettingsForm from './LineageSettingsForm';
import LoginSettings from './LoginSettings';
import LoginSettingsForm from './LoginSettingsForm';
import { PLATFORM_SETTINGS_HASH_TAB } from './PlatformSettings.constants';
import type {
  PlatformSettingsFormProps,
  PlatformSettingsPageId,
  PlatformSettingsPageProps,
  PlatformSettingsView,
} from './PlatformSettings.types';
import {
  getPageHeader,
  getVisiblePlatformSettingsPages,
  hashSubPathToView,
  viewToSubPath,
} from './PlatformSettings.utils';
import PlatformSettingsLanding from './PlatformSettingsLanding';
import ProfilerSettings from './ProfilerSettings';
import ProfilerSettingsForm from './ProfilerSettingsForm';
import EntitySearchSettings from './search/EntitySearchSettings';
import SearchSettingsView from './search/SearchSettingsView';
import TableSchemaSettings from './TableSchemaSettings';
import TableSchemaSettingsForm from './TableSchemaSettingsForm';
import ThemeSettings from './ThemeSettings';
import ThemeSettingsForm from './ThemeSettingsForm';

interface PlatformSettingsPanelProps {
  onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
}

const VIEW_PAGES: Partial<
  Record<
    PlatformSettingsPageId,
    (props: PlatformSettingsPageProps) => ReactNode
  >
> = {
  theme: (props) => <ThemeSettings {...props} />,
  email: (props) => <EmailSettings {...props} />,
  'login-configuration': (props) => <LoginSettings {...props} />,
  'health-check': (props) => <HealthCheckSettings {...props} />,
  'profiler-configuration': (props) => <ProfilerSettings {...props} />,
  'data-quality': (props) => <DataQualitySettings {...props} />,
  'brand-url': (props) => <BrandUrlSettings {...props} />,
  lineage: (props) => <LineageSettings {...props} />,
  'data-asset-rules': () => <DataAssetRulesSettings />,
  'learning-resources': (props) => <LearningResourcesSettings {...props} />,
  'app-mode': (props) => <AppModeSettings {...props} />,
  'table-schema': (props) => <TableSchemaSettings {...props} />,
  glossary: () => <GlossarySettings />,
  search: (props) =>
    props.itemId ? (
      <EntitySearchSettings {...props} />
    ) : (
      <SearchSettingsView {...props} />
    ),
};

/** The `/edit` view of each page that has one. */
const FORM_PAGES: Partial<
  Record<
    PlatformSettingsPageId,
    (props: PlatformSettingsFormProps) => ReactNode
  >
> = {
  theme: (props) => <ThemeSettingsForm {...props} />,
  email: (props) => <EmailSettingsForm {...props} />,
  'login-configuration': (props) => <LoginSettingsForm {...props} />,
  'profiler-configuration': (props) => <ProfilerSettingsForm {...props} />,
  'data-quality': (props) => <DimensionSettingsForm {...props} />,
  'brand-url': (props) => <BrandUrlSettingsForm {...props} />,
  lineage: (props) => <LineageSettingsForm {...props} />,
  'learning-resources': (props) => <LearningResourceSettingsForm {...props} />,
  'app-mode': (props) => <AppModeSettingsForm {...props} />,
  'table-schema': (props) => <TableSchemaSettingsForm {...props} />,
};

const isFormView = (view: PlatformSettingsView) =>
  view.type === 'page' && view.isEditing;

const PlatformSettingsPanel = ({
  onHeaderChange,
}: PlatformSettingsPanelProps) => {
  const { t } = useTranslation();
  const { state: hashState, setHash } = useSettingsHash();
  const authProvider = useApplicationStore(
    (state) => state.authConfig?.provider
  );
  const pages = useMemo(
    () => getVisiblePlatformSettingsPages(authProvider),
    [authProvider]
  );
  const [showHint, setShowHint] = useState(false);
  const [pageActions, setPageActions] = useState<ReactNode>();

  const view = useMemo(
    () =>
      hashSubPathToView(
        hashState.tab === PLATFORM_SETTINGS_HASH_TAB ? hashState.subPath : '',
        pages
      ),
    [hashState.tab, hashState.subPath, pages]
  );
  const activePage =
    view.type === 'page'
      ? pages.find((page) => page.id === view.page)
      : undefined;
  const showsForm = isFormView(view);

  const onNavigate = useCallback(
    (next: PlatformSettingsView) =>
      setHash(PLATFORM_SETTINGS_HASH_TAB, viewToSubPath(next)),
    [setHash]
  );

  useEffect(() => {
    if (!onHeaderChange) {
      return;
    }

    const rootLabel = t('label.platform-setting-plural');
    const breadcrumbs: { id: string; label: string }[] = [
      { id: 'settings', label: t('label.setting-plural') },
      { id: PLATFORM_SETTINGS_HASH_TAB, label: rootLabel },
    ];
    let title = rootLabel;

    if (activePage) {
      const header = getPageHeader(activePage, view, t);
      breadcrumbs.push(...header.breadcrumbs);
      title = header.title;
    }

    const hintToggle = (
      <Box align="center" direction="row" gap={2}>
        <Hint className="tw:size-4.5 tw:text-secondary" />
        <Typography size="text-sm" weight="medium">
          {t('label.show-hint')}
        </Typography>
        <Toggle
          aria-label={t('label.show-hint')}
          data-testid="show-hint-toggle"
          isSelected={showHint}
          onChange={setShowHint}
        />
      </Box>
    );

    onHeaderChange({
      breadcrumbs,
      title,
      description: t(
        activePage?.descriptionKey ?? 'message.customize-brand-description'
      ),
      icon: activePage?.icon ?? Sliders02,
      onBreadcrumbAction: (id: Key) => {
        if (id === PLATFORM_SETTINGS_HASH_TAB) {
          onNavigate({ type: 'landing' });
        } else if (id === activePage?.id) {
          onNavigate({ type: 'page', page: activePage.id, isEditing: false });
        }
      },
      actions:
        showsForm && activePage?.hasFieldHints !== false
          ? hintToggle
          : pageActions,
    });
  }, [
    activePage,
    onHeaderChange,
    onNavigate,
    pageActions,
    showHint,
    showsForm,
    t,
    view,
  ]);

  const content = (() => {
    if (view.type === 'landing') {
      return <PlatformSettingsLanding pages={pages} onNavigate={onNavigate} />;
    }

    if (showsForm) {
      return FORM_PAGES[view.page]?.({
        showHint,
        onNavigate,
        itemId: view.itemId,
      });
    }

    return VIEW_PAGES[view.page]?.({
      itemId: view.itemId,
      onNavigate,
      onSetHeaderActions: setPageActions,
    });
  })();

  return (
    <Box
      className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden"
      data-testid="platform-settings-panel"
      direction="col">
      <div
        className={
          showsForm
            ? 'tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden'
            : 'tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0'
        }>
        {/* Keyed by route so moving between items (edit A -> edit B, add ->
            edit, browser back/forward) remounts the page and loads its data. */}
        <Fragment key={viewToSubPath(view) ?? 'landing'}>{content}</Fragment>
      </div>
    </Box>
  );
};

export default PlatformSettingsPanel;
