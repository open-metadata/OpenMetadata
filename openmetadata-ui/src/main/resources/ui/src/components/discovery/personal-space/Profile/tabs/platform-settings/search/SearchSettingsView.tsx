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

import { Box, Button } from '@openmetadata/ui-core-components';
import { Plus, RefreshCcw01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FieldValueBoost,
  GlobalSettings,
  SearchSettings,
  TermBoost,
} from '../../../../../../../generated/configuration/searchSettings';
import {
  Settings,
  SettingType,
} from '../../../../../../../generated/settings/settings';
import { useAuth } from '../../../../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../../../../hooks/useApplicationStore';
import {
  getSettingsByType,
  restoreSettingsConfig,
  updateSettingsConfig,
} from '../../../../../../../rest/settingConfigAPI';
import searchSettingsClassBase from '../../../../../../../utils/SearchSettingsClassBase';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../../utils/ToastUtils';
import ConfirmDialog from '../ConfirmDialog';
import type { PlatformSettingsPageProps } from '../PlatformSettings.types';
import { SettingsSkeleton } from '../SettingsFormLayout';
import FieldValueBoostDialog from './FieldValueBoostDialog';
import FieldValueBoostTable from './FieldValueBoostTable';
import GlobalSearchSettings from './GlobalSearchSettings';
import HybridWeightsSection from './HybridWeightsSection';
import SearchEntityCards from './SearchEntityCards';
import SearchSection from './SearchSection';
import {
  complementWeight,
  upsertFieldValueBoost,
  upsertTermBoost,
} from './SearchSettings.utils';
import TermBoostCard from './TermBoostCard';

/** The global search settings, saved change by change as on the classic page. */
const SearchSettingsView = ({
  onNavigate,
  onSetHeaderActions,
}: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const setAppPreferences = useApplicationStore(
    (state) => state.setAppPreferences
  );
  const [config, setConfig] = useState<SearchSettings>();
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [termBoosts, setTermBoosts] = useState<TermBoost[]>([]);
  const [termBoostsChanged, setTermBoostsChanged] = useState(false);
  const [showNewTermBoost, setShowNewTermBoost] = useState(false);
  const [editingBoost, setEditingBoost] = useState<{
    boost?: FieldValueBoost;
  } | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'disable-columns' | null>(
    null
  );

  const applyConfig = useCallback(
    (next: SearchSettings, keepTermBoostDraft = false) => {
      setConfig(next);
      if (!keepTermBoostDraft) {
        setTermBoosts(next.globalSettings?.termBoosts ?? []);
        setTermBoostsChanged(false);
      }
      setAppPreferences({ searchConfig: next });
    },
    [setAppPreferences]
  );

  /** Resolves to whether the settings loaded; failures are already toasted. */
  const fetchConfig = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      applyConfig(
        (await getSettingsByType(SettingType.SearchSettings)) as SearchSettings
      );

      return true;
    } catch (error) {
      showErrorToast(error as AxiosError);

      return false;
    } finally {
      setIsLoading(false);
    }
  }, [applyConfig]);

  // Once per mount: under StrictMode a second response would wipe unsaved term boosts.
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      void fetchConfig();
    }
  }, [fetchConfig]);

  /** Resolves to whether the save succeeded, so editors close only on success. */
  const updateGlobalSettings = async (
    update: Partial<GlobalSettings>,
    successMessage?: string
  ): Promise<boolean> => {
    if (!config) {
      return false;
    }
    setIsUpdating(true);
    try {
      const { data } = await updateSettingsConfig({
        config_type: SettingType.SearchSettings,
        config_value: {
          ...config,
          globalSettings: { ...config.globalSettings, ...update },
        },
      } as Settings);
      // Unsaved term boost edits survive saves of other settings; they are
      // still saved only with their own Save button.
      applyConfig(
        data.config_value as SearchSettings,
        termBoostsChanged && !('termBoosts' in update)
      );
      showSuccessToast(
        successMessage ??
          t('server.update-entity-success', {
            entity: t('label.search-setting-plural'),
          })
      );

      return true;
    } catch (error) {
      showErrorToast(error as AxiosError);

      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReset = async () => {
    setIsUpdating(true);
    try {
      await restoreSettingsConfig(SettingType.SearchSettings);
      if (await fetchConfig()) {
        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.search-setting-plural'),
          })
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
      setConfirm(null);
    }
  };

  useEffect(() => {
    if (!isAdminUser) {
      return undefined;
    }
    onSetHeaderActions(
      <Button
        color="secondary"
        data-testid="reset-search-settings-btn"
        iconLeading={RefreshCcw01}
        isDisabled={isUpdating}
        size="sm"
        onPress={() => setConfirm('reset')}>
        {t('label.reset')}
      </Button>
    );

    return () => onSetHeaderActions(undefined);
  }, [isAdminUser, isUpdating, onSetHeaderActions, t]);

  // A new boost joins the list once it has both a tag and a boost.
  const handleTermBoostChange = (boost: TermBoost) => {
    if (!boost.value || !boost.boost) {
      return;
    }
    setTermBoosts((prev) => upsertTermBoost(prev, boost));
    setTermBoostsChanged(true);
    setShowNewTermBoost(false);
  };

  // Deleting a saved boost saves straight away, as the classic page did.
  const handleTermBoostDelete = (value: string) => {
    if (!termBoosts.some((boost) => boost.value === value)) {
      setShowNewTermBoost(false);

      return;
    }
    void updateGlobalSettings({
      termBoosts: termBoosts.filter((boost) => boost.value !== value),
    });
  };

  const handleSaveFieldValueBoost = async (boost: FieldValueBoost) => {
    const saved = await updateGlobalSettings({
      fieldValueBoosts: upsertFieldValueBoost(
        config?.globalSettings?.fieldValueBoosts,
        boost
      ),
    });
    if (saved) {
      setEditingBoost(null);
    }
  };

  const fieldValueBoostOptions = useMemo(
    () =>
      config?.allowedFieldValueBoosts?.[0]?.fields?.map(
        (field) => field.name
      ) ?? [],
    [config]
  );

  if (isLoading || !config) {
    return <SettingsSkeleton rows={6} />;
  }

  const global = config.globalSettings ?? {};
  const fieldValueBoosts = global.fieldValueBoosts ?? [];

  return (
    <Box data-testid="search-settings" direction="col" gap={8}>
      <GlobalSearchSettings
        globalSettings={global}
        isDisabled={isUpdating}
        onDisableColumnIndexing={() => setConfirm('disable-columns')}
        onUpdate={updateGlobalSettings}
      />

      {searchSettingsClassBase.showHybridSearchWeights() && (
        <HybridWeightsSection
          isDisabled={isUpdating}
          savedWeight={global.semanticWeight}
          onSave={(semanticWeight) =>
            updateGlobalSettings({
              semanticWeight,
              keywordWeight: complementWeight(semanticWeight),
            })
          }
        />
      )}

      <SearchSection
        actions={
          <>
            <Button
              color="secondary"
              data-testid="term-boost-save-btn"
              isDisabled={!termBoostsChanged || isUpdating}
              size="sm"
              onPress={() => updateGlobalSettings({ termBoosts })}>
              {t('label.save')}
            </Button>
            <Button
              color="primary"
              data-testid="term-boost-add-btn"
              iconLeading={Plus}
              isDisabled={isUpdating || showNewTermBoost}
              size="sm"
              onPress={() => setShowNewTermBoost(true)}>
              {t('label.add')}
            </Button>
          </>
        }
        count={termBoosts.length}
        testId="term-boosts"
        title={t('label.term-boost')}>
        <Box direction="row" gap={3} wrap="wrap">
          {termBoosts.map((boost) => (
            <TermBoostCard
              key={boost.value}
              termBoost={boost}
              onChange={handleTermBoostChange}
              onDelete={handleTermBoostDelete}
            />
          ))}
          {showNewTermBoost && (
            <TermBoostCard
              onChange={handleTermBoostChange}
              onDelete={handleTermBoostDelete}
            />
          )}
        </Box>
      </SearchSection>

      <SearchSection
        actions={
          <Button
            color="primary"
            data-testid="add-field-value-boost-btn"
            iconLeading={Plus}
            isDisabled={isUpdating}
            size="sm"
            onPress={() => setEditingBoost({})}>
            {t('label.add')}
          </Button>
        }
        count={fieldValueBoosts.length}
        testId="field-value-boosts"
        title={t('label.field-value-boost')}>
        <FieldValueBoostTable
          boosts={fieldValueBoosts}
          testId="field-value-boost-table"
          onDelete={(field) =>
            updateGlobalSettings({
              fieldValueBoosts: fieldValueBoosts.filter(
                (boost) => boost.field !== field
              ),
            })
          }
          onEdit={(boost) => setEditingBoost({ boost })}
        />
      </SearchSection>

      <SearchEntityCards onNavigate={onNavigate} />

      {editingBoost && (
        <FieldValueBoostDialog
          boost={editingBoost.boost}
          fieldOptions={fieldValueBoostOptions}
          onClose={() => setEditingBoost(null)}
          onSave={handleSaveFieldValueBoost}
        />
      )}

      <ConfirmDialog
        confirmLabel={t('label.reset')}
        isLoading={isUpdating}
        isOpen={confirm === 'reset'}
        message={t('message.reset-search-settings-confirmation')}
        testId="reset-search-settings-dialog"
        title={t('label.reset')}
        onCancel={() => setConfirm(null)}
        onConfirm={handleReset}
      />
      <ConfirmDialog
        isDestructive
        confirmLabel={t('label.disable')}
        isLoading={isUpdating}
        isOpen={confirm === 'disable-columns'}
        message={t('message.disable-column-indexing-confirmation')}
        testId="disable-column-indexing-dialog"
        title={t('label.column-indexing')}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await updateGlobalSettings({ enableColumnIndexing: false });
          setConfirm(null);
        }}
      />
    </Box>
  );
};

export default SearchSettingsView;
