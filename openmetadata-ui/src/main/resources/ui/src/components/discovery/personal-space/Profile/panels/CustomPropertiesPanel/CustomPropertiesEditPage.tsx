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

import { Box, Button } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CustomPropertyChanges,
  updateCustomPropertyByName,
} from '../../../../../../rest/metadataTypeAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import CustomPropertyEditForm from '../../../../../Settings/CustomProperty/CustomPropertyEditForm/CustomPropertyEditForm';
import { CustomPropertiesEditPageProps } from './CustomPropertiesPanel.types';

const CustomPropertiesEditPage: React.FC<CustomPropertiesEditPageProps> = ({
  entityType,
  property,
  showHint = false,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = useCallback(
    async (changes: CustomPropertyChanges) => {
      if (!entityType.fullyQualifiedName) {
        return;
      }

      setIsSaving(true);
      try {
        const updated = await updateCustomPropertyByName(
          entityType.fullyQualifiedName,
          property.name,
          changes
        );

        if (!updated) {
          showErrorToast(
            t('server.update-entity-error', {
              entity: t('label.custom-property'),
            })
          );

          return;
        }

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.custom-property'),
          })
        );
        onSuccess();
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsSaving(false);
      }
    },
    [entityType.fullyQualifiedName, onSuccess, property.name, t]
  );

  return (
    <Box
      className="tw:flex tw:h-full tw:flex-col tw:overflow-hidden"
      data-testid="custom-properties-edit-page"
      direction="col">
      <div className="tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0">
        <Box className="tw:max-w-[50%]" direction="col">
          <CustomPropertyEditForm
            formId="edit-custom-property-form"
            property={property}
            showHint={showHint}
            onSubmit={handleSubmit}
          />
        </Box>
      </div>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-background-base tw:px-8 tw:py-4 tw:shadow-sm"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="edit-custom-property-cancel"
          isDisabled={isSaving}
          type="button"
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="edit-custom-property-save"
          form="edit-custom-property-form"
          isLoading={isSaving}
          type="submit">
          {t('label.save-entity', { entity: t('label.change-plural') })}
        </Button>
      </Box>
    </Box>
  );
};

export default CustomPropertiesEditPage;
