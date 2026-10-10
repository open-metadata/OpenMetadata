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
  Grid,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DESTINATIONS_MIN_COUNT_ERROR_PATH } from '../../../components/Alerts/DestinationFormItem/DestinationFormItem.constants';
import InlineAlert from '../../../components/common/InlineAlert/InlineAlert';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { AlertAiFormValidationErrors } from '../../../components/observability/Alerts/AlertAiFormFields.interface';
import { validateAlertAiForm } from '../../../components/observability/Alerts/AlertAiFormFieldsValidationUtils';
import { AlertSelectionProvider } from '../../../hooks/useAlertSelection';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { ModifiedCreateEventSubscription } from '../AddObservabilityPage.interface';
import { ObservabilityAlertFormProps } from '../hooks/useObservabilityAlertForm';
import { getClassicAlertInitialValues } from './ObservabilityAlertForm.utils';
import ObservabilityAlertFormFields from './ObservabilityAlertFormFields';

function ObservabilityAlertForm({
  alert,
  breadcrumb,
  extraFormButtons,
  extraFormWidgets,
  filterResources,
  form,
  handleCancel,
  handleSave,
  inlineAlertDetails,
  isEditMode,
  isLoading,
  saving,
  selection,
  shouldShowActionsSection,
  shouldShowFiltersSection,
  templateResourcePermission,
  templates,
}: Readonly<ObservabilityAlertFormProps>) {
  const { t } = useTranslation();
  const values = form.watch();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const validationErrors = useMemo<AlertAiFormValidationErrors>(
    () => (hasSubmitted ? validateAlertAiForm(values, t) : {}),
    [hasSubmitted, values, t]
  );
  const { reset } = form;
  useEffect(() => {
    if (alert) {
      reset(getClassicAlertInitialValues(alert));
    }
  }, [alert, reset]);
  const submit = async (data: ModifiedCreateEventSubscription) => {
    const errors = validateAlertAiForm(data, t);
    setHasSubmitted(true);
    if (errors.destinations) {
      form.setError(DESTINATIONS_MIN_COUNT_ERROR_PATH, {
        message: errors.destinations,
        type: 'manual',
      });
    }
    if (Object.keys(errors).length === 0) {
      await handleSave(data);
    }
  };
  const onValuesChange = (changes: Partial<ModifiedCreateEventSubscription>) =>
    form.reset(
      { ...form.getValues(), ...changes },
      { keepErrors: true, keepDirty: true, keepTouched: true }
    );

  return (
    <Grid
      className="layout-row layout-grid"
      style={{ ...getLayoutGutter(16, 16) }}>
      <Grid.Item className="layout-column" span={24}>
        <TitleBreadcrumb titleLinks={breadcrumb} />
      </Grid.Item>

      <Grid.Item className="layout-column" span={24}>
        <Typography as="h5" size="text-md" weight="semibold">
          {t(`label.${isEditMode ? 'edit' : 'add'}-entity`, {
            entity: t('label.alert'),
          })}
        </Typography>
        <Typography>{t('message.alerts-description')}</Typography>
      </Grid.Item>

      <Grid.Item className="layout-column" span={24}>
        <FormProvider {...form}>
          <HookForm
            form={form}
            validationBehavior="aria"
            onSubmit={form.handleSubmit(submit, () => setHasSubmitted(true))}>
            <Grid
              className="layout-row layout-grid"
              style={{ ...getLayoutGutter(20, 20) }}>
              <AlertSelectionProvider value={selection}>
                <ObservabilityAlertFormFields
                  alert={alert}
                  extraFormWidgets={extraFormWidgets}
                  filterResources={filterResources}
                  form={form}
                  isLoading={isLoading}
                  shouldShowActionsSection={shouldShowActionsSection}
                  shouldShowFiltersSection={shouldShowFiltersSection}
                  templateResourcePermission={templateResourcePermission}
                  templates={templates}
                  validationErrors={validationErrors}
                />
              </AlertSelectionProvider>

              {!isUndefined(inlineAlertDetails) && (
                <Grid.Item className="layout-column" span={24}>
                  <InlineAlert {...inlineAlertDetails} />
                </Grid.Item>
              )}

              <Grid.Item className="layout-column" span={24}>
                <Box gap={2} justify="end">
                  <Button
                    color="tertiary"
                    data-testid="cancel-button"
                    size="sm"
                    onPress={handleCancel}>
                    {t('label.cancel')}
                  </Button>

                  {Object.entries(extraFormButtons).map(
                    ([name, ButtonComponent]) => (
                      <ButtonComponent
                        alertDetails={alert}
                        key={name}
                        templateResourcePermission={templateResourcePermission}
                        templates={templates}
                        values={values}
                        onValuesChange={onValuesChange}
                      />
                    )
                  )}
                  <Button
                    color="primary"
                    data-testid="save-button"
                    isLoading={saving}
                    size="sm"
                    type="submit">
                    {t('label.save')}
                  </Button>
                </Box>
              </Grid.Item>
            </Grid>
          </HookForm>
        </FormProvider>
      </Grid.Item>
    </Grid>
  );
}

export default ObservabilityAlertForm;
