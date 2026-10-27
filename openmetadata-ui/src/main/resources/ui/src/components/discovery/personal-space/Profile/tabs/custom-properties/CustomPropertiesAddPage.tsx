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
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Category, Type } from '../../../../../../generated/entity/type';
import {
  addPropertyToEntity,
  getTypeListByCategory,
} from '../../../../../../rest/metadataTypeAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import {
  AddCustomPropertyFormValues,
  CustomPropertiesAddPageProps,
} from './CustomPropertiesPanel.types';
import { toCustomPropertyPayload } from './CustomPropertiesPanel.utils';
import CustomPropertyFormFields from './CustomPropertyFormFields';

const CustomPropertiesAddPage: React.FC<CustomPropertiesAddPageProps> = ({
  entityType,
  showHint = false,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [propertyTypes, setPropertyTypes] = useState<Type[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [descriptionKey, setDescriptionKey] = useState(0);

  const form = useForm<AddCustomPropertyFormValues>({
    defaultValues: {
      name: '',
      displayName: '',
      propertyType: null,
      description: '',
      multiSelect: false,
    },
  });

  const fetchPropertyTypes = useCallback(async () => {
    try {
      const response = await getTypeListByCategory(Category.Field);
      setPropertyTypes(response.data ?? []);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, []);

  useEffect(() => {
    fetchPropertyTypes();
  }, [fetchPropertyTypes]);

  const handleSubmit = useCallback(
    async (data: AddCustomPropertyFormValues) => {
      if (!entityType.id) {
        return;
      }

      setIsSaving(true);
      try {
        await addPropertyToEntity(
          entityType.id,
          toCustomPropertyPayload(data, propertyTypes)
        );
        showSuccessToast(
          t('server.create-entity-success', {
            entity: t('label.custom-property'),
          })
        );
        setDescriptionKey((k) => k + 1);
        form.reset();
        onSuccess();
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsSaving(false);
      }
    },
    [entityType.id, form, onSuccess, propertyTypes, t]
  );

  return (
    <Box
      className="tw:flex tw:h-full tw:flex-col tw:overflow-hidden"
      data-testid="custom-properties-add-page"
      direction="col">
      <div className="tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0">
        <Box className="tw:max-w-[50%] tw:w-full tw:mx-auto" direction="col">
          <HookForm
            className="tw:flex tw:flex-col tw:gap-6"
            data-testid="custom-property-form"
            fieldDocDisplay="popover"
            form={form}
            id="add-custom-property-form"
            renderFieldDoc={(text) => (
              <Typography className="tw:text-tertiary" size="text-sm">
                {text}
              </Typography>
            )}
            showFieldDocs={showHint}
            onSubmit={form.handleSubmit(handleSubmit)}>
            <CustomPropertyFormFields
              descriptionKey={descriptionKey}
              form={form}
              propertyTypes={propertyTypes}
            />
          </HookForm>
        </Box>
      </div>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-surface tw:px-8 tw:py-4 tw:shadow-sm"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="custom-property-cancel"
          isDisabled={isSaving}
          type="button"
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="custom-property-save"
          form="add-custom-property-form"
          isLoading={isSaving}
          type="submit">
          {t('label.save-entity', { entity: t('label.change-plural') })}
        </Button>
      </Box>
    </Box>
  );
};

export default CustomPropertiesAddPage;
