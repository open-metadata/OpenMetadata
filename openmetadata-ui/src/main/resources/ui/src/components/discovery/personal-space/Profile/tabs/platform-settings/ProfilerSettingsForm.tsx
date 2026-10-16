/*
 *  Copyright 2023 Collate.
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
import {
  Box,
  Button,
  ButtonUtility,
  FieldTypes,
  getField,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, XClose } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SettingType } from '../../../../../../generated/settings/settings';
import { updateSettingsConfig } from '../../../../../../rest/settingConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import {
  ALL_METRICS,
  DATA_TYPE_ITEMS,
  fetchProfilerConfig,
  METRIC_ITEMS,
  ProfilerFormValues,
  toProfilerConfig,
  toProfilerFormValues,
} from './ProfilerSettings.utils';
import SettingsFormLayout, {
  SettingsFormSection,
  SettingsSkeleton,
} from './SettingsFormLayout';
import { useSettingsFetch } from './useSettingsFetch';

const EMPTY_VALUES: ProfilerFormValues = {
  metricConfiguration: [],
  storeSampleData: true,
  readSampleData: true,
};

const ProfilerSettingsForm = ({
  showHint,
  onNavigate,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const allLabel = t('label.all');
  // Read through a ref so a language change relabels the "All" chip without
  // resetting the form and discarding edits.
  const allLabelRef = useRef(allLabel);
  allLabelRef.current = allLabel;
  const { data: config, isLoading } = useSettingsFetch(fetchProfilerConfig);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<ProfilerFormValues>({ defaultValues: EMPTY_VALUES });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'metricConfiguration',
  });
  const rows = useWatch({ control: form.control, name: 'metricConfiguration' });
  const storeSampleData = useWatch({
    control: form.control,
    name: 'storeSampleData',
  });

  useEffect(() => {
    if (config) {
      form.reset(toProfilerFormValues(config, allLabelRef.current));
    }
  }, [config, form]);

  // Storing sample data needs it read first, so enabling one enables both.
  useEffect(() => {
    if (storeSampleData) {
      form.setValue('readSampleData', true);
    }
  }, [form, storeSampleData]);

  const metricItems = useMemo(
    () => [{ id: ALL_METRICS, label: allLabel }, ...METRIC_ITEMS],
    [allLabel]
  );

  // A data type can be configured once; types used by other rows are disabled.
  const usedDataTypes = new Set(
    (rows ?? []).map((row) => row?.dataType?.id).filter(Boolean)
  );

  const rowFields = (index: number): FieldProp[] => {
    const current = rows?.[index];

    return [
      {
        name: `metricConfiguration.${index}.dataType`,
        label: t('label.data-type'),
        type: FieldTypes.SELECT,
        required: true,
        placeholder: t('label.select-field', { field: t('label.data-type') }),
        props: {
          'data-testid': 'data-type-select',
          'aria-label': t('label.data-type'),
          items: DATA_TYPE_ITEMS.map((item) => ({
            ...item,
            isDisabled:
              usedDataTypes.has(item.id) && current?.dataType?.id !== item.id,
          })),
        },
        rules: {
          required: t('message.field-text-is-required', {
            fieldText: t('label.data-type'),
          }),
        },
      },
      {
        name: `metricConfiguration.${index}.metrics`,
        label: t('label.metric-type'),
        type: FieldTypes.MULTI_SELECT,
        placeholder: t('label.select-field', { field: t('label.metric-type') }),
        props: {
          'data-testid': 'metric-type-select',
          'aria-label': t('label.metric-type'),
          items: metricItems,
          isDisabled: Boolean(current?.disabled),
          maxVisibleItems: 5,
        },
      },
      {
        name: `metricConfiguration.${index}.disabled`,
        label: t('label.disable'),
        type: FieldTypes.SWITCH,
        props: { 'data-testid': 'disabled-switch' },
      },
    ];
  };

  const sampleDataFields: FieldProp[] = [
    {
      name: 'storeSampleData',
      label: t('label.enable-storing-of-sample-data'),
      type: FieldTypes.SWITCH,
      props: { 'data-testid': 'store-sample-data-switch' },
    },
    {
      name: 'readSampleData',
      label: t('label.enable-reading-of-sample-data'),
      type: FieldTypes.SWITCH,
      props: { 'data-testid': 'read-sample-data-switch' },
    },
  ];

  const backToView = () =>
    onNavigate({
      type: 'page',
      page: 'profiler-configuration',
      isEditing: false,
    });

  const handleSubmit = async (values: ProfilerFormValues) => {
    setIsSaving(true);
    try {
      await updateSettingsConfig({
        config_type: SettingType.ProfilerConfiguration,
        config_value: toProfilerConfig(values),
      });
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.profiler-configuration'),
        })
      );
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
        <SettingsSkeleton rows={6} />
      </div>
    );
  }

  return (
    <SettingsFormLayout
      form={form}
      isSaving={isSaving}
      showHint={showHint}
      testId="profiler-config-form"
      onCancel={backToView}
      onSubmit={handleSubmit}>
      <SettingsFormSection title={t('label.metric-configuration')}>
        <Box className="tw:md:col-span-2" direction="col" gap={5}>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.metric-configuration-description')}
          </Typography>
          {fields.map((row, index) => {
            const [dataType, metrics, disabled] = rowFields(index);

            return (
              <Box
                align="start"
                className="tw:grid tw:grid-cols-[1fr_1.4fr_auto_auto] tw:gap-4"
                data-testid={`metric-row-${index}`}
                key={row.id}>
                {getField(dataType)}
                {getField(metrics)}
                {getField(disabled)}
                <ButtonUtility
                  className="tw:mt-7"
                  color="tertiary"
                  data-testid={`remove-filter-${index}`}
                  icon={XClose}
                  size="sm"
                  tooltip={t('label.remove')}
                  onPress={() => remove(index)}
                />
              </Box>
            );
          })}
          <Button
            className="tw:self-start"
            color="link-color"
            data-testid="add-fields"
            iconLeading={Plus}
            size="sm"
            onPress={() =>
              append({ dataType: null, metrics: [], disabled: false })
            }>
            {t('label.add-new-field')}
          </Button>
        </Box>
      </SettingsFormSection>

      <SettingsFormSection
        title={t('label.sample-data-ingestion-configuration')}>
        <Typography
          className="tw:text-tertiary tw:md:col-span-2"
          size="text-sm">
          {t('message.sample-data-ingestion-config-description')}
        </Typography>
        {sampleDataFields.map((field) => (
          <div key={field.name}>{getField(field)}</div>
        ))}
      </SettingsFormSection>
    </SettingsFormLayout>
  );
};

export default ProfilerSettingsForm;
