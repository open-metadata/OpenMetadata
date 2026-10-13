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
import { Box, FieldTypes, getField } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ResourceType,
  RESOURCE_TYPE_LABEL_KEYS,
  RESOURCE_TYPE_VALUES,
  SOURCE_URL_PLACEHOLDERS,
} from '../../../../../../constants/Learning.constants';
import {
  createLearningResource,
  getLearningResourceById,
  LearningResource,
  updateLearningResource,
} from '../../../../../../rest/learningResourceAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import { ResourceTypeIcon } from '../../../../../Learning/ResourceTypeIcon/ResourceTypeIcon';
import {
  CATEGORY_ITEMS,
  CONTEXT_ITEMS,
  DURATION_ITEMS,
  LearningResourceFormValues,
  STATUS_ITEMS,
  toLearningResourceFormValues,
  toLearningResourcePayload,
} from './LearningResourceSettings.utils';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import SettingsFormLayout, {
  SettingsFormSection,
  SettingsSkeleton,
} from './SettingsFormLayout';
import { isValidUrl } from './ThemeSettings.utils';
import { useSettingsFetch } from './useSettingsFetch';

/** Add (no `itemId`) or edit the learning resource with id `itemId`. */
const LearningResourceSettingsForm = ({
  showHint,
  itemId,
  onNavigate,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const fetchResource = useCallback(
    async (): Promise<LearningResource | undefined> =>
      itemId ? getLearningResourceById(itemId) : undefined,
    [itemId]
  );
  const { data: resource, isLoading } = useSettingsFetch(fetchResource);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<LearningResourceFormValues>({
    defaultValues: toLearningResourceFormValues(),
  });
  const resourceType = useWatch({
    control: form.control,
    name: 'resourceType',
  });

  useEffect(() => {
    if (resource) {
      form.reset(toLearningResourceFormValues(resource));
    }
  }, [form, resource]);

  // A stale or deleted id: the fetch has already toasted, so return to the list.
  useEffect(() => {
    if (itemId && !isLoading && !resource) {
      onNavigate({
        type: 'page',
        page: 'learning-resources',
        isEditing: false,
      });
    }
  }, [isLoading, itemId, onNavigate, resource]);

  const required = useCallback(
    (labelKey: string) => ({
      required: t('label.field-required', { field: t(labelKey) }),
    }),
    [t]
  );

  const fields: FieldProp[] = useMemo(
    () => [
      {
        name: 'name',
        label: t('label.name'),
        type: FieldTypes.TEXT,
        required: true,
        placeholder: t('label.enter-entity', { entity: t('label.name') }),
        // The name identifies the resource and cannot change once created.
        props: { 'data-testid': 'name-input', isDisabled: Boolean(itemId) },
        rules: required('label.name'),
      },
      {
        name: 'description',
        label: t('label.description'),
        type: FieldTypes.TEXTAREA,
        required: true,
        props: { 'data-testid': 'description-input' },
        rules: required('label.description'),
      },
      {
        name: 'resourceType',
        label: t('label.type'),
        type: FieldTypes.SELECT,
        required: true,
        placeholder: t('label.select-field', { field: t('label.type') }),
        props: {
          'data-testid': 'resource-type-select',
          items: RESOURCE_TYPE_VALUES.map((type) => ({
            id: type,
            label: t(RESOURCE_TYPE_LABEL_KEYS[type]),
            icon: <ResourceTypeIcon aria-hidden resourceType={type} />,
          })),
        },
        rules: required('label.type'),
      },
      {
        name: 'categories',
        label: t('label.category-plural'),
        type: FieldTypes.MULTI_SELECT,
        required: true,
        placeholder: t('label.select-type'),
        props: { 'data-testid': 'categories-select', items: CATEGORY_ITEMS },
        // RHF treats an empty array as missing, so `required` covers multi-selects.
        rules: required('label.category-plural'),
      },
      {
        name: 'contexts',
        label: t('label.context'),
        type: FieldTypes.MULTI_SELECT,
        required: true,
        placeholder: t('label.select-field', { field: t('label.context') }),
        props: { 'data-testid': 'contexts-select', items: CONTEXT_ITEMS },
        rules: required('label.context'),
      },
      {
        name: 'sourceUrl',
        label: t('label.source-url'),
        type: FieldTypes.TEXT,
        required: true,
        placeholder:
          SOURCE_URL_PLACEHOLDERS[
            (resourceType?.id as ResourceType) ?? ResourceType.Video
          ],
        props: { 'data-testid': 'source-url-input' },
        rules: {
          ...required('label.source-url'),
          validate: (value: string) =>
            isValidUrl(value) || t('label.invalid-url'),
        },
      },
      {
        name: 'sourceProvider',
        label: t('label.source-provider'),
        type: FieldTypes.TEXT,
        placeholder: 'YouTube, Storylane, etc.',
        props: { 'data-testid': 'source-provider-input' },
      },
      {
        name: 'estimatedDuration',
        label: t('label.duration'),
        type: FieldTypes.SELECT,
        placeholder: t('label.select-duration'),
        props: { 'data-testid': 'duration-select', items: DURATION_ITEMS },
      },
      {
        name: 'status',
        label: t('label.status'),
        type: FieldTypes.SELECT,
        placeholder: t('label.select-status'),
        props: { 'data-testid': 'status-select', items: STATUS_ITEMS },
      },
    ],
    [itemId, required, resourceType, t]
  );

  const backToList = () =>
    onNavigate({ type: 'page', page: 'learning-resources', isEditing: false });

  const handleSubmit = async (values: LearningResourceFormValues) => {
    setIsSaving(true);
    try {
      const payload = toLearningResourcePayload(values, resource);
      if (resource) {
        await updateLearningResource(payload);
      } else {
        await createLearningResource(payload);
      }
      showSuccessToast(
        t(
          resource
            ? 'server.entity-updated-success'
            : 'server.create-entity-success',
          { entity: t('label.learning-resource') }
        )
      );
      backToList();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  if (itemId && (isLoading || !resource)) {
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
      testId="learning-resource-form"
      onCancel={backToList}
      onSubmit={handleSubmit}>
      <SettingsFormSection>
        {fields.map((field) => (
          <Box
            className={
              field.name === 'description' ? 'tw:md:col-span-2' : undefined
            }
            direction="col"
            key={field.name}>
            {getField(field)}
          </Box>
        ))}
      </SettingsFormSection>
    </SettingsFormLayout>
  );
};

export default LearningResourceSettingsForm;
