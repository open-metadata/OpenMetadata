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
  Button,
  Card,
  RadioButton,
  RadioGroup,
  Select,
  SelectItem,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete, Plus } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { Key, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import {
  DefaultAppMode,
  DefaultViewMode,
} from '../../../generated/api/configuration/appConfiguration';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  setAppDefaultMode,
  translateWireMode,
} from '../../../hooks/useAppMode';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../rest/settingConfigAPI';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ViewModeRow } from './GeneralPreferencesPage.types';
import {
  buildRowsFromViewModes,
  buildViewModesMap,
  DOMAIN_PAGE_ID,
  generateRowId,
  getViewOptionsForPage,
  PAGE_OPTIONS,
  serializeViewModes,
} from './GeneralPreferencesPage.utils';

// Sentinel value for the "no tenant default" radio option — the wire value
// for that choice is `null`, but native form controls can't carry `null` as
// a value, so we translate at the option/handler boundary only.
const NO_DEFAULT_VALUE = 'null';

interface AppModeOption {
  value: string;
  labelKey: string;
}

// The tenant default is the fixed `DefaultAppMode` wire enum (`ai` | `classic`)
// plus the "no default" sentinel — not a runtime registry — so the options are
// a static list rather than something derived from the router.
const APP_MODE_OPTIONS: AppModeOption[] = [
  { value: NO_DEFAULT_VALUE, labelKey: 'label.no-default' },
  { value: DefaultAppMode.Classic, labelKey: 'label.classic' },
  { value: DefaultAppMode.AI, labelKey: 'label.ai' },
];

const GeneralPreferencesPage: React.FC = () => {
  const { t } = useTranslation();
  const { setDefaultViewModes } = useApplicationStore();
  const pageTitle = t('label.general-preferences');

  const breadcrumbs = useMemo(
    () => [
      { name: t('label.setting-plural'), url: getSettingPath() },
      {
        name: t('label.preference-plural'),
        url: getSettingPath(GlobalSettingsMenuCategory.PREFERENCES),
      },
      { name: pageTitle, url: '' },
    ],
    [t, pageTitle]
  );

  const [initialAppMode, setInitialAppMode] =
    useState<string>(NO_DEFAULT_VALUE);
  const [currentAppMode, setCurrentAppMode] =
    useState<string>(NO_DEFAULT_VALUE);
  const [isSavingAppMode, setIsSavingAppMode] = useState(false);

  const [initialRows, setInitialRows] = useState<ViewModeRow[]>([]);
  const [rows, setRows] = useState<ViewModeRow[]>([]);
  const [isSavingViewModes, setIsSavingViewModes] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  // Both sections read from the same tenant config, so one load populates
  // both — App Mode and View Mode still save independently below.
  useEffect(() => {
    let isMounted = true;

    getAppConfiguration()
      .then((config) => {
        if (!isMounted) {
          return;
        }
        const appMode = config?.defaultAppMode ?? NO_DEFAULT_VALUE;
        setInitialAppMode(appMode);
        setCurrentAppMode(appMode);

        const viewModeRows = buildRowsFromViewModes(config?.defaultViewModes);
        setInitialRows(viewModeRows);
        setRows(viewModeRows);
      })
      .catch((error: AxiosError) => {
        // A failed load leaves `rows` empty — saving from that state would
        // replace the server's whole `defaultViewModes` map with whatever
        // was added since, wiping every previously-saved page default.
        // Block both Saves until a real config (even an empty one) has
        // loaded.
        if (isMounted) {
          setHasLoadError(true);
        }
        showErrorToast(error);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isAppModeDirty = currentAppMode !== initialAppMode;
  const isAppModeSaveDisabled =
    !isAppModeDirty || isLoading || hasLoadError || isSavingAppMode;

  const isViewModesDirty =
    serializeViewModes(buildViewModesMap(rows)) !==
    serializeViewModes(buildViewModesMap(initialRows));
  // A row with only a page or only a view set is dropped silently by
  // `buildViewModesMap` — saving while one exists would submit a map that's
  // missing that row's (and possibly a previously-saved) entry without any
  // indication to the admin.
  const hasIncompleteRow = rows.some(
    (row) => Boolean(row.page) !== Boolean(row.view)
  );
  const isViewRowsInvalid = hasIncompleteRow || hasLoadError;
  const isViewModesSaveDisabled =
    !isViewModesDirty || isViewRowsInvalid || isLoading || isSavingViewModes;

  // App Mode and View Mode each save independently through the same
  // `patchAppConfiguration` — it read-modify-writes against the stored
  // config, so one section's partial patch can never wipe the other
  // section's already-saved field.
  const handleSaveAppMode = async () => {
    setIsSavingAppMode(true);
    try {
      const defaultAppMode =
        currentAppMode === NO_DEFAULT_VALUE
          ? null
          : (currentAppMode as DefaultAppMode);
      await patchAppConfiguration({ defaultAppMode });
      setInitialAppMode(currentAppMode);
      // Same translation AuthProvider runs at boot — keeps the boot-time
      // fallback cache (`getAppDefaultMode`) current so the *next*
      // login/reload, for this admin and for everyone else, picks up the
      // new tenant default. It does NOT change the mode already active in
      // this tab: that's driven by `useAppModeStore`/`writeAppMode`, which
      // this call never touches, and a live boot-style write here risks
      // transiently flipping the active mode mid-session (see
      // `removeAppModeSession`'s doc comment in useAppMode.ts).
      setAppDefaultMode(translateWireMode(defaultAppMode));
      showSuccessToast(
        t('server.entity-updated-success', {
          entity: t('label.default-app-mode'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingAppMode(false);
    }
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { id: generateRowId(), page: null, view: null },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleRowPageChange = (id: string, page: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) {
          return row;
        }
        // Tree is only a valid view for the domains page — switching a row
        // away from domains would otherwise leave a stale Tree value silently
        // attached to a page whose toggle doesn't offer it.
        const view =
          page !== DOMAIN_PAGE_ID && row.view === DefaultViewMode.Tree
            ? null
            : row.view;

        return { ...row, page, view };
      })
    );
  };

  const handleRowViewChange = (id: string, view: DefaultViewMode) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, view } : row))
    );
  };

  const handleSaveViewModes = async () => {
    setIsSavingViewModes(true);
    try {
      const defaultViewModes = buildViewModesMap(rows);
      await patchAppConfiguration({ defaultViewModes });
      setInitialRows(rows);
      // Keeps the live store in sync so pages reading `defaultViewModes`
      // pick up the new tenant default without a reload.
      setDefaultViewModes(defaultViewModes);
      showSuccessToast(
        t('server.entity-updated-success', {
          entity: t('label.default-view-per-page'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingViewModes(false);
    }
  };

  return (
    <Box
      className="tw:p-6"
      data-testid="general-preferences-page"
      direction="col">
      <DocumentTitle title={pageTitle} />
      <Box className="tw:mb-2 tw:shrink-0">
        <TitleBreadcrumb titleLinks={breadcrumbs} />
      </Box>
      <Typography
        as="h1"
        className="not-prose tw:text-lg tw:font-semibold tw:mb-2">
        {pageTitle}
      </Typography>
      <Typography as="p" className="not-prose tw:text-secondary tw:mb-6">
        {t('message.general-preferences-description')}
      </Typography>

      <Typography
        as="h2"
        className="not-prose tw:text-md tw:font-semibold tw:mb-2">
        {t('label.default-app-mode')}
      </Typography>
      <Typography as="p" className="not-prose tw:text-secondary tw:mb-6">
        {t('message.default-app-mode-description')}
      </Typography>
      <Card className="tw:mb-8">
        <Card.Content>
          <RadioGroup
            aria-label={t('label.default-app-mode')}
            data-testid="app-mode-radio-group"
            value={currentAppMode}
            onChange={setCurrentAppMode}>
            {APP_MODE_OPTIONS.map((option) => (
              <RadioButton
                data-testid={`app-mode-option-${option.value}`}
                key={option.value}
                label={t(option.labelKey)}
                value={option.value}
              />
            ))}
          </RadioGroup>
        </Card.Content>
        <Card.Footer>
          <Button
            color="primary"
            data-testid="save-app-mode-settings"
            isDisabled={isAppModeSaveDisabled}
            isLoading={isSavingAppMode}
            onPress={handleSaveAppMode}>
            {t('label.save')}
          </Button>
        </Card.Footer>
      </Card>

      <Typography
        as="h2"
        className="not-prose tw:text-md tw:font-semibold tw:mb-2">
        {t('label.default-view-per-page')}
      </Typography>
      <Typography as="p" className="not-prose tw:text-secondary tw:mb-6">
        {t('message.default-view-per-page-description')}
      </Typography>
      <Card>
        <Card.Content>
          <Box
            className="tw:flex tw:flex-col tw:gap-3"
            data-testid="default-view-modes-section"
            direction="col">
            {rows.map((row) => {
              const otherSelectedPages = new Set(
                rows
                  .filter((otherRow) => otherRow.id !== row.id && otherRow.page)
                  .map((otherRow) => otherRow.page as string)
              );
              const pageItems = PAGE_OPTIONS.filter(
                (option) =>
                  option.id === row.page || !otherSelectedPages.has(option.id)
              ).map((option) => ({ id: option.id, label: t(option.labelKey) }));
              const viewItems = getViewOptionsForPage(row.page).map(
                (option) => ({
                  id: option.id,
                  label: t(option.labelKey),
                })
              );

              return (
                <Box
                  className="tw:flex tw:items-center tw:gap-2"
                  data-testid={`view-mode-row-${row.id}`}
                  key={row.id}>
                  <Select
                    aria-label={t('label.page')}
                    className="tw:flex-1 tw:min-w-0"
                    data-testid={`view-mode-row-page-${row.id}`}
                    items={pageItems}
                    placeholder={t('label.select-field', {
                      field: t('label.page'),
                    })}
                    selectedKey={row.page}
                    onSelectionChange={(key: Key | null) =>
                      key && handleRowPageChange(row.id, String(key))
                    }>
                    {(item) => <SelectItem id={item.id} label={item.label} />}
                  </Select>
                  <Select
                    aria-label={t('label.view')}
                    className="tw:flex-1 tw:min-w-0"
                    data-testid={`view-mode-row-view-${row.id}`}
                    items={viewItems}
                    placeholder={t('label.select-field', {
                      field: t('label.view'),
                    })}
                    selectedKey={row.view}
                    onSelectionChange={(key: Key | null) =>
                      key && handleRowViewChange(row.id, key as DefaultViewMode)
                    }>
                    {(item) => <SelectItem id={item.id} label={item.label} />}
                  </Select>
                  <Button
                    aria-label={t('label.remove')}
                    color="secondary"
                    data-testid={`remove-view-mode-row-${row.id}`}
                    iconLeading={Delete}
                    size="xs"
                    onPress={() => handleRemoveRow(row.id)}
                  />
                </Box>
              );
            })}
            <Box>
              <Button
                color="secondary"
                data-testid="add-view-mode-row"
                iconLeading={Plus}
                isDisabled={rows.length >= PAGE_OPTIONS.length}
                size="xs"
                onPress={handleAddRow}>
                {t('label.add-field')}
              </Button>
            </Box>
          </Box>
        </Card.Content>
        <Card.Footer>
          <Button
            color="primary"
            data-testid="save-view-modes-settings"
            isDisabled={isViewModesSaveDisabled}
            isLoading={isSavingViewModes}
            onPress={handleSaveViewModes}>
            {t('label.save')}
          </Button>
        </Card.Footer>
      </Card>
    </Box>
  );
};

export default GeneralPreferencesPage;
