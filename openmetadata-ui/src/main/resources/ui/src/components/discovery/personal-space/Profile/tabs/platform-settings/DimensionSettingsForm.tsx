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
  FieldTypes,
  getField,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DIMENSION_COLOR_PALETTE } from '../../../../../../constants/DataQualityDimension.constants';
import { DataQualityDimension } from '../../../../../../generated/tests/dataQualityDimension';
import {
  createDataQualityDimension,
  patchDataQualityDimension,
} from '../../../../../../rest/dataQualityDimensionAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import { fetchDimensionList } from './DataQualitySettings.utils';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import SettingsFormLayout, {
  SettingsFormSection,
  SettingsSkeleton,
} from './SettingsFormLayout';
import { useSettingsFetch } from './useSettingsFetch';

export interface DimensionFormValues {
  name: string;
  displayName: string;
  description: string;
  color: string;
}

const DIMENSION_NAME_PATTERN = /^[\w-]+$/;

const toFormValues = (
  dimension?: DataQualityDimension
): DimensionFormValues => ({
  name: dimension?.name ?? '',
  displayName: dimension?.displayName ?? '',
  description: dimension?.description ?? '',
  color: dimension?.style?.color ?? DIMENSION_COLOR_PALETTE[0],
});

/** Add (no `itemId`) or edit the dimension named `itemId`. */
const DimensionSettingsForm = ({
  showHint,
  itemId,
  onNavigate,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const isEditing = Boolean(itemId);
  const { data, isLoading } = useSettingsFetch(fetchDimensionList);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<DimensionFormValues>({ defaultValues: toFormValues() });
  const [color, name, displayName] = useWatch({
    control: form.control,
    name: ['color', 'name', 'displayName'],
  });

  const editing = useMemo(
    () => data?.dimensions.find((dimension) => dimension.name === itemId),
    [data, itemId]
  );

  const backToList = () =>
    onNavigate({ type: 'page', page: 'data-quality', isEditing: false });

  // Runs once per loaded list, so a not-found link toasts once. `t` is read
  // through a ref: it is not data this effect reacts to.
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    if (!isEditing || !data) {
      return;
    }
    if (editing) {
      form.reset(toFormValues(editing));
    } else {
      // Stale deep link: the dimension was deleted.
      showErrorToast(
        tRef.current('server.entity-fetch-error', {
          entity: tRef.current('label.dimension'),
        })
      );
      onNavigate({ type: 'page', page: 'data-quality', isEditing: false });
    }
  }, [data, editing, form, isEditing, onNavigate]);

  const fields: FieldProp[] = useMemo(
    () => [
      {
        name: 'name',
        label: t('label.name'),
        type: FieldTypes.TEXT,
        required: true,
        // The name is referenced by the API and every test case relationship.
        doc: isEditing
          ? t('message.dimension-name-is-fixed-after-creation')
          : t('message.dimension-name-help'),
        props: { 'data-testid': 'dimension-name', isDisabled: isEditing },
        rules: {
          required: t('label.field-required', { field: t('label.name') }),
          pattern: {
            value: DIMENSION_NAME_PATTERN,
            message: t('message.dimension-name-invalid'),
          },
        },
      },
      {
        name: 'displayName',
        label: t('label.display-name'),
        type: FieldTypes.TEXT,
        doc: t('message.dimension-display-name-help'),
        props: { 'data-testid': 'dimension-display-name' },
      },
      {
        name: 'description',
        label: t('label.description'),
        type: FieldTypes.TEXTAREA,
        placeholder: t('message.dimension-description-placeholder'),
        props: { 'data-testid': 'dimension-description' },
      },
      {
        name: 'color',
        label: t('label.color'),
        type: FieldTypes.COLOR_PICKER,
        props: {
          'data-testid': 'dimension-color',
          colors: DIMENSION_COLOR_PALETTE,
        },
      },
    ],
    [isEditing, t]
  );

  const handleSubmit = async (values: DimensionFormValues) => {
    setIsSaving(true);
    try {
      if (editing) {
        const updated: DataQualityDimension = {
          ...editing,
          displayName: values.displayName || undefined,
          description: values.description || undefined,
          style: { ...editing.style, color: values.color },
        };
        await patchDataQualityDimension(
          editing.id ?? '',
          compare(editing, updated)
        );
      } else {
        await createDataQualityDimension({
          name: values.name,
          displayName: values.displayName || undefined,
          description: values.description || undefined,
          style: { color: values.color },
        });
      }
      showSuccessToast(
        t(
          editing
            ? 'server.update-entity-success'
            : 'server.create-entity-success',
          { entity: t('label.dimension') }
        )
      );
      backToList();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing && (isLoading || !editing)) {
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
      testId="dimension-form"
      onCancel={backToList}
      onSubmit={handleSubmit}>
      <SettingsFormSection title={t('label.dimension')}>
        <Box className="tw:md:col-span-2" direction="col" gap={5}>
          {fields.map((field) => (
            <div key={field.name}>{getField(field)}</div>
          ))}
        </Box>
      </SettingsFormSection>

      <SettingsFormSection title={t('label.preview')}>
        <Box
          className="tw:md:col-span-2"
          data-testid="dimension-preview"
          direction="col"
          gap={3}>
          <Box align="center" direction="row" gap={2}>
            <span
              className="tw:size-2.5 tw:rounded-full"
              style={{ backgroundColor: color }}
            />
            <Typography size="text-sm" weight="semibold">
              {displayName || name || t('label.dimension')}
            </Typography>
          </Box>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.data-quality-dimensions-description')}
          </Typography>
        </Box>
      </SettingsFormSection>
    </SettingsFormLayout>
  );
};

export default DimensionSettingsForm;
