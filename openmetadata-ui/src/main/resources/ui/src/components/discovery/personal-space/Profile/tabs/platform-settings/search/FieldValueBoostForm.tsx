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

import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SearchSettings } from '../../../../../../../generated/configuration/searchSettings';
import {
  Settings,
  SettingType,
} from '../../../../../../../generated/settings/settings';
import { useApplicationStore } from '../../../../../../../hooks/useApplicationStore';
import {
  getSettingsByType,
  updateSettingsConfig,
} from '../../../../../../../rest/settingConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../../utils/ToastUtils';
import type { PlatformSettingsFormProps } from '../PlatformSettings.types';
import SettingsFormLayout, { SettingsSkeleton } from '../SettingsFormLayout';
import { useSettingsFetch } from '../useSettingsFetch';
import FieldValueBoostFields from './FieldValueBoostFields';
import {
  EntitySearchSavedState,
  FieldValueBoostFormValues,
  parseFieldValueBoostItemId,
  toFieldValueBoost,
  toFieldValueBoostFormValues,
  upsertFieldValueBoost,
} from './SearchSettings.utils';

const fetchSearchSettings = async () =>
  (await getSettingsByType(SettingType.SearchSettings)) as SearchSettings;

/**
 * Adds or edits one field value boost. Global boosts save straight away; an
 * entity's boosts go back into that entity page's unsaved draft, which the
 * page handed over through `savedState`.
 */
const FieldValueBoostForm = ({
  itemId,
  showHint,
  onNavigate,
  savedState,
  onSaveState,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const setAppPreferences = useApplicationStore(
    (state) => state.setAppPreferences
  );
  const { entity, field } = parseFieldValueBoostItemId(itemId);
  const entityState = savedState as EntitySearchSavedState | undefined;
  const draft =
    entity && entityState?.entity === entity ? entityState.draft : undefined;
  const isMissingDraft = Boolean(entity) && !draft;
  const { data: config, isLoading } = useSettingsFetch(fetchSearchSettings);
  const [isSaving, setIsSaving] = useState(false);

  const boosts = entity
    ? draft?.fieldValueBoosts
    : config?.globalSettings?.fieldValueBoosts;
  const boost = field
    ? boosts?.find((item) => item.field === field)
    : undefined;

  const form = useForm<FieldValueBoostFormValues>({
    defaultValues: toFieldValueBoostFormValues(),
  });

  useEffect(() => {
    form.reset(toFieldValueBoostFormValues(boost));
  }, [boost, form]);

  const fieldOptions = useMemo(
    () =>
      config?.allowedFieldValueBoosts?.[0]?.fields?.map((item) => item.name) ??
      [],
    [config]
  );

  const backToParent = () =>
    onNavigate({
      type: 'page',
      page: 'search',
      isEditing: false,
      itemId: entity,
    });

  // A refresh or deep link loses the entity's draft: nothing to add the boost to.
  useEffect(() => {
    if (isMissingDraft) {
      backToParent();
    }
    // Navigate once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMissingDraft]);

  const saveGlobal = async (values: FieldValueBoostFormValues) => {
    if (!config) {
      return;
    }
    setIsSaving(true);
    try {
      const { data } = await updateSettingsConfig({
        config_type: SettingType.SearchSettings,
        config_value: {
          ...config,
          globalSettings: {
            ...config.globalSettings,
            fieldValueBoosts: upsertFieldValueBoost(
              config.globalSettings?.fieldValueBoosts,
              toFieldValueBoost(values)
            ),
          },
        },
      } as Settings);
      setAppPreferences({ searchConfig: data.config_value as SearchSettings });
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.search-setting-plural'),
        })
      );
      backToParent();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (values: FieldValueBoostFormValues) => {
    if (!entityState || !draft) {
      await saveGlobal(values);

      return;
    }
    onSaveState?.({
      ...entityState,
      draft: {
        ...draft,
        fieldValueBoosts: upsertFieldValueBoost(
          draft.fieldValueBoosts,
          toFieldValueBoost(values)
        ),
      },
      isChanged: true,
    });
    backToParent();
  };

  if (isLoading || isMissingDraft) {
    return (
      <div className="tw:p-8 tw:pt-0">
        <SettingsSkeleton rows={6} />
      </div>
    );
  }

  return (
    <SettingsFormLayout
      isCentered
      form={form}
      isSaving={isSaving}
      showHint={showHint}
      testId="field-value-boost-form"
      onCancel={backToParent}
      onSubmit={handleSubmit}>
      <FieldValueBoostFields
        boost={boost}
        fieldOptions={fieldOptions}
        form={form}
      />
    </SettingsFormLayout>
  );
};

export default FieldValueBoostForm;
