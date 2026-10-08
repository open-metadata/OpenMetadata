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

import type { FieldProp } from '@openmetadata/ui-core-components';
import { FieldTypes, FormFields } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  LineageLayer,
  LineageSettings,
  PipelineViewMode,
} from '../../../../../../generated/configuration/lineageSettings';
import { SettingType } from '../../../../../../generated/settings/settings';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { updateSettingsConfig } from '../../../../../../rest/settingConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import {
  fetchLineageSettings,
  LINEAGE_LAYER_LABELS,
  PIPELINE_VIEW_MODE_LABELS,
} from './LineageSettings';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import { nonNegativeNumberRules } from './PlatformSettings.utils';
import SettingsFormLayout, {
  SettingsFormSection,
  SettingsSkeleton,
} from './SettingsFormLayout';
import { useFormFieldDocs } from './useFormFieldDocs';
import { useSettingsFetch } from './useSettingsFetch';

interface SelectOption {
  id: string;
  label?: string;
}

interface LineageFormValues {
  upstreamDepth: string;
  downstreamDepth: string;
  lineageLayer: SelectOption | null;
  pipelineViewMode: SelectOption | null;
}

const LineageSettingsForm = ({
  showHint,
  onNavigate,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const docs = useFormFieldDocs('LineageConfiguration');
  const setAppPreferences = useApplicationStore(
    (state) => state.setAppPreferences
  );
  const { data: config, isLoading } = useSettingsFetch(fetchLineageSettings);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<LineageFormValues>({
    defaultValues: {
      upstreamDepth: '',
      downstreamDepth: '',
      lineageLayer: null,
      pipelineViewMode: null,
    },
  });

  const layerOptions = useMemo(
    () =>
      Object.values(LineageLayer).map((id) => ({
        id,
        label: t(LINEAGE_LAYER_LABELS[id]),
      })),
    [t]
  );
  const viewModeOptions = useMemo(
    () =>
      Object.values(PipelineViewMode).map((id) => ({
        id,
        label: t(PIPELINE_VIEW_MODE_LABELS[id]),
      })),
    [t]
  );

  // Selects resolve their label from `items` by id, so the reset only needs
  // ids; keeping translated options out of the deps avoids re-resetting the
  // form whenever `t` changes identity.
  useEffect(() => {
    form.reset({
      upstreamDepth: config?.upstreamDepth?.toString() ?? '',
      downstreamDepth: config?.downstreamDepth?.toString() ?? '',
      lineageLayer: config?.lineageLayer ? { id: config.lineageLayer } : null,
      pipelineViewMode: config?.pipelineViewMode
        ? { id: config.pipelineViewMode }
        : null,
    });
  }, [config, form]);

  const fields = useMemo(() => {
    const depthField = (
      name: 'upstreamDepth' | 'downstreamDepth',
      labelKey: string,
      testId: string
    ): FieldProp => ({
      name,
      label: t(labelKey),
      type: FieldTypes.NUMBER,
      required: true,
      doc: docs[name],
      props: { 'data-testid': testId },
      rules: nonNegativeNumberRules(t, labelKey, true),
    });
    const selectField = (
      name: 'lineageLayer' | 'pipelineViewMode',
      labelKey: string,
      testId: string,
      items: SelectOption[]
    ): FieldProp => ({
      name,
      label: t(labelKey),
      type: FieldTypes.SELECT,
      doc: docs[name],
      props: { 'data-testid': testId, items },
    });

    return [
      depthField('upstreamDepth', 'label.upstream-depth', 'field-upstream'),
      depthField(
        'downstreamDepth',
        'label.downstream-depth',
        'field-downstream'
      ),
      selectField(
        'lineageLayer',
        'label.lineage-layer',
        'field-lineage-layer',
        layerOptions
      ),
      selectField(
        'pipelineViewMode',
        'label.pipeline-view-mode',
        'field-pipeline-view-mode',
        viewModeOptions
      ),
    ];
  }, [docs, layerOptions, t, viewModeOptions]);

  const backToView = () =>
    onNavigate({ type: 'page', page: 'lineage', isEditing: false });

  const handleSubmit = async (values: LineageFormValues) => {
    setIsSaving(true);
    try {
      const { data } = await updateSettingsConfig({
        config_type: SettingType.LineageSettings,
        config_value: {
          upstreamDepth: Number(values.upstreamDepth),
          downstreamDepth: Number(values.downstreamDepth),
          lineageLayer: values.lineageLayer?.id as LineageLayer,
          pipelineViewMode: values.pipelineViewMode?.id as PipelineViewMode,
        },
      });
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.lineage-config'),
        })
      );
      setAppPreferences({
        lineageConfig: data.config_value as LineageSettings,
      });
      backToView();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="tw:p-8 tw:pt-0">
        <SettingsSkeleton rows={4} />
      </div>
    );
  }

  return (
    <SettingsFormLayout
      form={form}
      isSaving={isSaving}
      showHint={showHint}
      testId="lineage-config-form"
      onCancel={backToView}
      onSubmit={handleSubmit}>
      <SettingsFormSection title={t('label.lineage')}>
        <FormFields fields={fields} />
      </SettingsFormSection>
    </SettingsFormLayout>
  );
};

export default LineageSettingsForm;
