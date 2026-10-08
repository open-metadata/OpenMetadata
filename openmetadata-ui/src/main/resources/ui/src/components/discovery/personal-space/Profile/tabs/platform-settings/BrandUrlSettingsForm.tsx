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
import { FieldTypes, getField } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SettingType } from '../../../../../../generated/settings/settings';
import { updateSettingsConfig } from '../../../../../../rest/settingConfigAPI';
import { getHyperlinkUrlValidationErrorKey } from '../../../../../../utils/CustomProperty.utils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import { fetchBrandUrlConfig } from './BrandUrlSettings';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import SettingsFormLayout, {
  SettingsFormSection,
  SettingsSkeleton,
} from './SettingsFormLayout';
import { useFormFieldDocs } from './useFormFieldDocs';
import { useSettingsFetch } from './useSettingsFetch';

interface BrandUrlFormValues {
  openMetadataUrl: string;
}

const BrandUrlSettingsForm = ({
  showHint,
  onNavigate,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const docs = useFormFieldDocs('OpenMetadataUrlConfiguration');
  const { data: config, isLoading } = useSettingsFetch(fetchBrandUrlConfig);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<BrandUrlFormValues>({
    defaultValues: { openMetadataUrl: '' },
  });

  useEffect(() => {
    form.reset({ openMetadataUrl: config?.openMetadataUrl ?? '' });
  }, [config, form]);

  const urlField: FieldProp = useMemo(
    () => ({
      name: 'openMetadataUrl',
      label: t('label.brand-name-url'),
      type: FieldTypes.TEXT,
      required: true,
      doc: docs.openMetadataUrl,
      props: { 'data-testid': 'open-metadata-url-input' },
      rules: {
        required: t('label.field-required', {
          field: t('label.brand-name-url'),
        }),
        validate: (value: string) => {
          const errorKey = getHyperlinkUrlValidationErrorKey(value);

          return errorKey ? t(errorKey) : true;
        },
      },
    }),
    [docs, t]
  );

  const backToView = () =>
    onNavigate({ type: 'page', page: 'brand-url', isEditing: false });

  const handleSubmit = async (values: BrandUrlFormValues) => {
    setIsSaving(true);
    try {
      await updateSettingsConfig({
        config_type: SettingType.OpenMetadataBaseURLConfiguration,
        config_value: values,
      });
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.entity-configuration', {
            entity: t('label.brand-name-url'),
          }),
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
        <SettingsSkeleton rows={1} />
      </div>
    );
  }

  return (
    <SettingsFormLayout
      form={form}
      isSaving={isSaving}
      showHint={showHint}
      testId="brand-url-form"
      onCancel={backToView}
      onSubmit={handleSubmit}>
      <SettingsFormSection title={t('label.general')}>
        {getField(urlField)}
      </SettingsFormSection>
    </SettingsFormLayout>
  );
};

export default BrandUrlSettingsForm;
