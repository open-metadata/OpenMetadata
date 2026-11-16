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
import { useEffect, useState } from 'react';
import { FormProvider, useWatch, Watch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DESTINATIONS_MIN_COUNT_ERROR_PATH } from '../../../components/Alerts/DestinationFormItem/DestinationFormItem.constants';
import InlineAlert from '../../../components/common/InlineAlert/InlineAlert';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { AlertAiFormValidationErrors } from '../../../components/observability/Alerts/AlertAiFormFields.interface';
import { validateAlertAiForm } from '../../../components/observability/Alerts/AlertAiFormFieldsValidationUtils';
import { AlertSelectionProvider } from '../../../hooks/useAlertSelection';
import {
  applyAlertValueChanges,
  getClassicAlertInitialValues,
} from '../../../utils/Alerts/ClassicAlertForm.utils';
import { ModifiedCreateEventSubscription } from '../AddObservabilityPage.interface';
import { ObservabilityAlertFormProps } from '../hooks/useObservabilityAlertForm';
import ObservabilityAlertFormFields from './ObservabilityAlertFormFields';

const NO_ERRORS: AlertAiFormValidationErrors = {};

function ObservabilityAlertForm({
  alert,
  breadcrumb,
  extraFormButtons,
  extraFormWidgets,
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
  const [hasSubmitted, setHasSubmitted] = useState(false);
  // `compute` re-renders this form only when the errors change, not on every keystroke.
  const currentErrors = useWatch({
    control: form.control,
    compute: (values) => validateAlertAiForm(values, t),
  });
  const validationErrors: AlertAiFormValidationErrors = hasSubmitted
    ? currentErrors
    : NO_ERRORS;
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
    applyAlertValueChanges(form.setValue, changes);

  return (
    <Grid
      className="layout-row layout-grid tw:[--layout-gutter:var(--om-space-16)] tw:-mx-2"
      rowGap="4">
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
              className="layout-row layout-grid tw:[--layout-gutter:var(--om-space-20)] tw:-mx-2.5"
              rowGap="5">
              <AlertSelectionProvider value={selection}>
                <ObservabilityAlertFormFields
                  alert={alert}
                  extraFormWidgets={extraFormWidgets}
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
                      <Watch
                        control={form.control}
                        key={name}
                        render={(values) => (
                          <ButtonComponent
                            alertDetails={alert}
                            templateResourcePermission={
                              templateResourcePermission
                            }
                            templates={templates}
                            values={values}
                            onValuesChange={onValuesChange}
                          />
                        )}
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
