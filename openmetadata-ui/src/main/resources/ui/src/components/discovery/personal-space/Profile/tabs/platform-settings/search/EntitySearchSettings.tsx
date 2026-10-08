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
  Dropdown,
  Select,
} from '@openmetadata/ui-core-components';
import { Plus, RefreshCcw01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_PATH } from '../../../../../../../constants/constants';
import {
  AllowedFieldField,
  BoostMode,
  FieldValueBoost,
  ScoreMode,
  SearchSettings,
  TermBoost,
} from '../../../../../../../generated/configuration/searchSettings';
import {
  Settings,
  SettingType,
} from '../../../../../../../generated/settings/settings';
import { useApplicationStore } from '../../../../../../../hooks/useApplicationStore';
import { getCustomPropertiesByEntityType } from '../../../../../../../rest/metadataTypeAPI';
import {
  getSettingsByType,
  restoreSettingsConfig,
  updateSettingsConfig,
} from '../../../../../../../rest/settingConfigAPI';
import {
  getEffectiveRankingConfiguration,
  getEntitySearchConfig,
} from '../../../../../../../utils/SearchSettingsUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../../utils/ToastUtils';
import ConfirmDialog from '../ConfirmDialog';
import type { PlatformSettingsPageProps } from '../PlatformSettings.types';
import { SettingsSkeleton } from '../SettingsFormLayout';
import FieldValueBoostDialog from './FieldValueBoostDialog';
import FieldValueBoostTable from './FieldValueBoostTable';
import MatchingFieldCard from './MatchingFieldCard';
import RankingSection, {
  BOOST_MODE_ITEMS,
  SCORE_MODE_ITEMS,
} from './RankingSection';
import SearchPreviewPanel from './SearchPreviewPanel';
import SearchSection, { SearchSectionTitle } from './SearchSection';
import {
  EntitySearchDraft,
  toEntityDraft,
  toggleHighlightField,
  toggleSearchField,
  updateSearchField,
  upsertFieldValueBoost,
  upsertTermBoost,
  withEntityDraft,
} from './SearchSettings.utils';
import TermBoostCard from './TermBoostCard';

/**
 * One entity's search settings, edited as a draft with a live preview and
 * saved together, as on the classic page.
 */
const EntitySearchSettings = ({
  itemId = '',
  onNavigate,
  onSetHeaderActions,
}: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const entityType: string | undefined =
    ENTITY_PATH[itemId as keyof typeof ENTITY_PATH];
  const setAppPreferences = useApplicationStore(
    (state) => state.setAppPreferences
  );
  const [config, setConfig] = useState<SearchSettings>();
  const [draft, setDraft] = useState<EntitySearchDraft>(toEntityDraft());
  const [isChanged, setIsChanged] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customProperties, setCustomProperties] = useState<AllowedFieldField[]>(
    []
  );
  const [lastAddedField, setLastAddedField] = useState<string>();
  const [showNewTermBoost, setShowNewTermBoost] = useState(false);
  const [editingBoost, setEditingBoost] = useState<{
    boost?: FieldValueBoost;
  } | null>(null);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);

  const applyConfig = useCallback(
    (next: SearchSettings) => {
      setConfig(next);
      setAppPreferences({ searchConfig: next });
      if (entityType) {
        const entityConfig = getEntitySearchConfig(next, entityType);
        setDraft(
          toEntityDraft(
            entityConfig ?? undefined,
            getEffectiveRankingConfiguration(next, entityConfig ?? null)
          )
        );
      }
      setIsChanged(false);
    },
    [entityType, setAppPreferences]
  );

  /** Resolves to whether the settings loaded; failures are already toasted. */
  const fetchConfig = useCallback(async (): Promise<boolean> => {
    try {
      applyConfig(
        (await getSettingsByType(SettingType.SearchSettings)) as SearchSettings
      );

      return true;
    } catch (error) {
      showErrorToast(error as AxiosError);

      return false;
    }
  }, [applyConfig]);

  // Once per mount (the page remounts per entity): under StrictMode a second
  // response would reset a draft the user has already started editing.
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!entityType) {
      // A stale or mistyped link: back to the entity list.
      onNavigate({ type: 'page', page: 'search', isEditing: false });

      return;
    }
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;
    void fetchConfig();
    getCustomPropertiesByEntityType(entityType)
      .then((properties) =>
        setCustomProperties(
          properties.map((property) => ({
            name: `extension.${property.name}`,
            description: `${property.description ?? property.displayName} (${t(
              'label.custom-property'
            )})`,
          }))
        )
      )
      .catch(() => setCustomProperties([]));
    // Load once per entity; `t` is not a reason to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  const updateDraft = (update: Partial<EntitySearchDraft>) => {
    setDraft((prev) => ({ ...prev, ...update }));
    setIsChanged(true);
  };

  const handleSave = useCallback(async () => {
    if (!config || !entityType) {
      return;
    }
    setIsSaving(true);
    try {
      const { data } = await updateSettingsConfig({
        config_type: SettingType.SearchSettings,
        config_value: withEntityDraft(config, entityType, draft),
      } as Settings);
      applyConfig(data.config_value as SearchSettings);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.search-setting-plural'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  }, [applyConfig, config, draft, entityType, t]);

  const handleRestore = async () => {
    setIsSaving(true);
    try {
      await restoreSettingsConfig(SettingType.SearchSettings);
      if (await fetchConfig()) {
        showSuccessToast(
          t('server.restore-entity-success', {
            entity: t('label.search-setting-plural'),
          })
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
      setIsRestoreOpen(false);
    }
  };

  useEffect(() => {
    onSetHeaderActions(
      <Box direction="row" gap={3}>
        <Button
          color="secondary"
          data-testid="restore-defaults-btn"
          iconLeading={RefreshCcw01}
          isDisabled={!config || isSaving}
          size="sm"
          onPress={() => setIsRestoreOpen(true)}>
          {t('label.restore-default-plural')}
        </Button>
        <Button
          color="primary"
          data-testid="save-btn"
          isDisabled={!isChanged || isSaving}
          isLoading={isSaving}
          size="sm"
          onPress={handleSave}>
          {t('label.save')}
        </Button>
      </Box>
    );

    return () => onSetHeaderActions(undefined);
  }, [config, handleSave, isChanged, isSaving, onSetHeaderActions, t]);

  const entityFields = useMemo(() => {
    const allowed =
      config?.allowedFields?.find((item) => item.entityType === entityType)
        ?.fields ?? [];

    return [...allowed, ...customProperties];
  }, [config, customProperties, entityType]);

  const unselectedFields = entityFields.filter(
    (field) => !draft.searchFields.some((item) => item.field === field.name)
  );

  const previewConfig = useMemo(
    () =>
      config && entityType
        ? withEntityDraft(config, entityType, draft)
        : undefined,
    [config, draft, entityType]
  );

  if (!config || !entityType || !previewConfig) {
    return <SettingsSkeleton rows={6} />;
  }

  const handleTermBoostChange = (boost: TermBoost) => {
    if (!boost.value || !boost.boost) {
      return;
    }
    updateDraft({ termBoosts: upsertTermBoost(draft.termBoosts, boost) });
    setShowNewTermBoost(false);
  };

  const handleTermBoostDelete = (value: string) => {
    // A new card that never got a boost was never added to the draft.
    if (!draft.termBoosts.some((boost) => boost.value === value)) {
      setShowNewTermBoost(false);

      return;
    }
    updateDraft({
      termBoosts: draft.termBoosts.filter((boost) => boost.value !== value),
    });
  };

  return (
    <div
      className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-6 tw:xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
      data-testid="entity-search-settings">
      <Box direction="col" gap={8}>
        <Box direction="col" gap={3}>
          <SearchSectionTitle>
            {t('label.ranking-detail-plural')}
          </SearchSectionTitle>
          <RankingSection
            ranking={draft.ranking}
            onChange={(ranking) => updateDraft({ ranking })}
          />
        </Box>

        <SearchSection
          actions={
            <Dropdown.Root>
              <Button
                color="secondary"
                data-testid="add-field-btn"
                iconLeading={Plus}
                isDisabled={unselectedFields.length === 0}
                size="sm">
                {t('label.add')}
              </Button>
              <Dropdown.Popover className="tw:w-max tw:min-w-56">
                <Dropdown.Menu
                  className="tw:max-h-80 tw:overflow-y-auto"
                  onAction={(key) => {
                    setLastAddedField(String(key));
                    updateDraft({
                      searchFields: toggleSearchField(
                        draft.searchFields,
                        String(key)
                      ),
                    });
                  }}>
                  {unselectedFields.map((field) => (
                    <Dropdown.Item
                      data-testid={`add-field-${field.name}`}
                      id={field.name}
                      key={field.name}>
                      {field.name}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          }
          count={draft.searchFields.length}
          testId="field-configurations"
          title={t('label.matching-fields')}>
          {draft.searchFields.map((field) => {
            const entityField = entityFields.find(
              (item) => item.name === field.field
            );

            return (
              <MatchingFieldCard
                description={entityField?.description}
                field={field}
                initialOpen={field.field === lastAddedField}
                isHighlightAllowed={entityField?.highlight ?? false}
                isHighlighted={draft.highlightFields.includes(field.field)}
                key={field.field}
                onChange={(update) =>
                  updateDraft({
                    searchFields: updateSearchField(
                      draft.searchFields,
                      field.field,
                      update
                    ),
                  })
                }
                onDelete={() =>
                  updateDraft({
                    searchFields: toggleSearchField(
                      draft.searchFields,
                      field.field
                    ),
                  })
                }
                onToggleHighlight={() =>
                  updateDraft({
                    highlightFields: toggleHighlightField(
                      draft.highlightFields,
                      field.field
                    ),
                  })
                }
              />
            );
          })}
          <div className="tw:grid tw:grid-cols-2 tw:gap-3">
            <Select
              data-testid="score-mode-select"
              items={SCORE_MODE_ITEMS}
              label={t('label.score-mode')}
              size="sm"
              value={draft.scoreMode ?? null}
              onChange={(key) => updateDraft({ scoreMode: key as ScoreMode })}>
              {(item) => <Select.Item id={item.id} label={item.label} />}
            </Select>
            <Select
              data-testid="boost-mode-select"
              items={BOOST_MODE_ITEMS}
              label={t('label.boost-mode')}
              size="sm"
              value={draft.boostMode ?? null}
              onChange={(key) => updateDraft({ boostMode: key as BoostMode })}>
              {(item) => <Select.Item id={item.id} label={item.label} />}
            </Select>
          </div>
        </SearchSection>

        <SearchSection
          actions={
            <Button
              color="secondary"
              data-testid="add-term-boost-btn"
              iconLeading={Plus}
              isDisabled={showNewTermBoost}
              size="sm"
              onPress={() => setShowNewTermBoost(true)}>
              {t('label.add')}
            </Button>
          }
          count={draft.termBoosts.length}
          testId="term-boosts"
          title={t('label.term-boost')}>
          <Box direction="row" gap={3} wrap="wrap">
            {draft.termBoosts.map((boost) => (
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
              color="secondary"
              data-testid="add-field-value-boost-btn"
              iconLeading={Plus}
              size="sm"
              onPress={() => setEditingBoost({})}>
              {t('label.add')}
            </Button>
          }
          count={draft.fieldValueBoosts.length}
          testId="field-value-boosts"
          title={t('label.field-value-boost')}>
          <FieldValueBoostTable
            isCompact
            boosts={draft.fieldValueBoosts}
            testId="entity-field-value-boost-table"
            onDelete={(field) =>
              updateDraft({
                fieldValueBoosts: draft.fieldValueBoosts.filter(
                  (boost) => boost.field !== field
                ),
              })
            }
            onEdit={(boost) => setEditingBoost({ boost })}
          />
        </SearchSection>
      </Box>

      <SearchPreviewPanel
        entityType={entityType}
        searchConfig={previewConfig}
      />

      {editingBoost && (
        <FieldValueBoostDialog
          boost={editingBoost.boost}
          fieldOptions={
            config.allowedFieldValueBoosts?.[0]?.fields?.map(
              (field) => field.name
            ) ?? []
          }
          onClose={() => setEditingBoost(null)}
          onSave={(boost) => {
            updateDraft({
              fieldValueBoosts: upsertFieldValueBoost(
                draft.fieldValueBoosts,
                boost
              ),
            });
            setEditingBoost(null);
          }}
        />
      )}

      <ConfirmDialog
        confirmLabel={t('label.restore-default-plural')}
        isLoading={isSaving}
        isOpen={isRestoreOpen}
        message={t('message.reset-search-settings-confirmation')}
        testId="restore-defaults-dialog"
        title={t('label.restore-default-plural')}
        onCancel={() => setIsRestoreOpen(false)}
        onConfirm={handleRestore}
      />
    </div>
  );
};

export default EntitySearchSettings;
