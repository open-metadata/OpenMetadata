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
  Alert,
  Box,
  FormField,
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import { Table } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DefaultColumnOrder } from '../../../../../../generated/api/configuration/appConfiguration';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../../../../rest/settingConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import SettingsFormLayout, {
  SettingsFormSection,
  SettingsSkeleton,
} from './SettingsFormLayout';
import {
  COLUMN_ORDER_OPTIONS,
  getEffectiveColumnOrder,
} from './TableSchemaSettings';
import { useSettingsFetch } from './useSettingsFetch';

interface TableSchemaFormValues {
  defaultColumnOrder: DefaultColumnOrder;
}

const TableSchemaSettingsForm = ({
  showHint,
  onNavigate,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const setAppPreferences = useApplicationStore(
    (state) => state.setAppPreferences
  );
  const { data: config, isLoading } = useSettingsFetch(getAppConfiguration);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<TableSchemaFormValues>({
    defaultValues: { defaultColumnOrder: DefaultColumnOrder.Alphabetical },
  });

  useEffect(() => {
    form.reset({
      defaultColumnOrder: getEffectiveColumnOrder(config?.defaultColumnOrder),
    });
  }, [config, form]);

  const backToView = () =>
    onNavigate({ type: 'page', page: 'table-schema', isEditing: false });

  const handleSubmit = async ({
    defaultColumnOrder,
  }: TableSchemaFormValues) => {
    setIsSaving(true);
    try {
      await patchAppConfiguration({ defaultColumnOrder });
      // Table pages opened from now on in this session use the new default.
      setAppPreferences({ defaultColumnOrder });
      showSuccessToast(
        t('server.entity-updated-success', {
          entity: t('label.table-and-schema'),
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
        <SettingsSkeleton rows={3} />
      </div>
    );
  }

  return (
    <SettingsFormLayout
      form={form}
      isSaveDisabled={!form.formState.isDirty}
      isSaving={isSaving}
      showHint={showHint}
      testId="table-schema-form"
      onCancel={backToView}
      onSubmit={handleSubmit}>
      <SettingsFormSection title={t('label.default-column-order')}>
        <Box className="tw:md:col-span-2" direction="col" gap={4}>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.default-column-order-description')}
          </Typography>
          <FormField control={form.control} name="defaultColumnOrder">
            {({ field }) => (
              <RadioGroup
                aria-label={t('label.default-column-order')}
                data-testid="default-column-order-radio-group"
                value={field.value}
                onChange={field.onChange}>
                {COLUMN_ORDER_OPTIONS.map((option) => (
                  <RadioButton
                    data-testid={`column-order-option-${option.value}`}
                    hint={t(option.hintKey)}
                    key={option.value}
                    label={option.getLabel(t)}
                    value={option.value}
                  />
                ))}
              </RadioGroup>
            )}
          </FormField>
          <Alert icon={Table} variant="gray">
            {t('message.default-column-order-note')}
          </Alert>
        </Box>
      </SettingsFormSection>
    </SettingsFormLayout>
  );
};

export default TableSchemaSettingsForm;
