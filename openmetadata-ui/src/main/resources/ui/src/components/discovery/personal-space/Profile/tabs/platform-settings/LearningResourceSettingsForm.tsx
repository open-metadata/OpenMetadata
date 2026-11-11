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

import { Box, getField } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
import {
  LearningResourceFormValues,
  toLearningResourceFormValues,
  toLearningResourcePayload,
} from './LearningResourceSettings.utils';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import SettingsFormLayout, {
  SettingsFormSection,
  SettingsSkeleton,
} from './SettingsFormLayout';
import { useLearningResourceFields } from './useLearningResourceFields';
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

  const fields = useLearningResourceFields(Boolean(itemId), resourceType);

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
      centered
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
