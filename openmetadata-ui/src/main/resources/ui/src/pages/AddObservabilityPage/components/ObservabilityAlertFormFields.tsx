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
  Divider,
  FormField,
  FormItemLabel,
  Grid,
  Input,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import AlertFormSourceItem from '../../../components/Alerts/AlertFormSourceItem/AlertFormSourceItem';
import DestinationFormItem from '../../../components/Alerts/DestinationFormItem/DestinationFormItem.component';
import ObservabilityFormFiltersItem from '../../../components/Alerts/ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import ObservabilityFormTriggerItem from '../../../components/Alerts/ObservabilityFormTriggerItem/ObservabilityFormTriggerItem';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import {
  AlertAiFormFieldsProps,
  AlertAiFormValidationErrors,
} from '../../../components/observability/Alerts/AlertAiFormFields.interface';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { ModifiedCreateEventSubscription } from '../AddObservabilityPage.interface';
import { ObservabilityAlertFormFieldsProps } from '../hooks/useObservabilityAlertForm';

import { getAlertSourceChanges } from './ObservabilityAlertForm.utils';

function ObservabilityAlertFormFields({
  alert,
  extraFormWidgets,
  filterResources,
  form,
  isLoading,
  shouldShowActionsSection,
  shouldShowFiltersSection,
  templateResourcePermission,
  templates,
  validationErrors,
}: Readonly<
  ObservabilityAlertFormFieldsProps & {
    validationErrors: AlertAiFormValidationErrors;
  }
>) {
  const { t } = useTranslation();
  const values = form.watch();
  const onChange: AlertAiFormFieldsProps['onChange'] = (next) => {
    const latest = typeof next === 'function' ? next(form.getValues()) : next;
    form.setValue('input', latest.input, { shouldDirty: true });
  };
  const onValuesChange = (changes: Partial<ModifiedCreateEventSubscription>) =>
    form.reset(
      { ...form.getValues(), ...changes },
      { keepErrors: true, keepDirty: true, keepTouched: true }
    );

  return (
    <>
      <Grid.Item className="layout-column" span={24}>
        <FormField
          control={form.control}
          name="displayName"
          rules={{
            required: t('label.field-required', { field: t('label.name') }),
            maxLength: {
              value: 128,
              message: t('message.entity-size-in-between', {
                entity: t('label.name'),
                min: 1,
                max: 128,
              }),
            },
            pattern: {
              value: ENTITY_NAME_REGEX,
              message: t('message.entity-name-validation'),
            },
          }}>
          {({ field, fieldState }) => (
            <Input
              {...field}
              isRequired
              hint={fieldState.error?.message ?? validationErrors.displayName}
              id="displayName"
              inputDataTestId="displayName"
              isInvalid={
                fieldState.invalid || Boolean(validationErrors.displayName)
              }
              label={t('label.name')}
              placeholder={t('label.name')}
              value={field.value ?? ''}
              onChange={(value) => {
                field.onChange(value);
                void form.trigger('displayName');
              }}
            />
          )}
        </FormField>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <Box direction="col" gap={2}>
          <FormItemLabel label={t('label.description')} />
          <FormField control={form.control} name="description">
            {({ field }) => (
              <RichTextEditor
                data-testid="description"
                initialValue={alert?.description}
                onTextChange={field.onChange}
              />
            )}
          </FormField>
        </Box>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <Box className="layout-row" justify="center" wrap="wrap">
          <Box
            className="layout-column tw:block"
            style={{ maxWidth: '100%', flex: '0 0 100%' }}>
            <AlertFormSourceItem
              error={validationErrors.resources}
              filterResources={filterResources}
              value={values.resources}
              onChange={(next, previous) => {
                onValuesChange(getAlertSourceChanges(next, previous));
              }}
            />
          </Box>
          {shouldShowFiltersSection && (
            <>
              <Box className="layout-column tw:block">
                <Divider
                  dashed
                  className="tw:mx-2 tw:h-6 tw:border-r"
                  orientation="vertical"
                />
              </Box>
              <Box
                className="layout-column tw:block"
                style={{ maxWidth: '100%', flex: '0 0 100%' }}>
                <ObservabilityFormFiltersItem
                  validationErrors={validationErrors}
                  value={values}
                  onChange={onChange}
                />
              </Box>
            </>
          )}
          {shouldShowActionsSection && (
            <>
              <Box className="layout-column tw:block">
                <Divider
                  dashed
                  className="tw:mx-2 tw:h-6 tw:border-r"
                  orientation="vertical"
                />
              </Box>
              <Box
                className="layout-column tw:block"
                style={{ maxWidth: '100%', flex: '0 0 100%' }}>
                <ObservabilityFormTriggerItem
                  validationErrors={validationErrors}
                  value={values}
                  onChange={onChange}
                />
              </Box>
            </>
          )}
          <Box className="layout-column tw:block">
            <Divider
              dashed
              className="tw:mx-2 tw:h-6 tw:border-r"
              orientation="vertical"
            />
          </Box>
          <Box
            className="layout-column tw:block"
            style={{ maxWidth: '100%', flex: '0 0 100%' }}>
            <DestinationFormItem />
          </Box>

          {!isEmpty(extraFormWidgets) && (
            <>
              {Object.entries(extraFormWidgets).map(([name, Widget]) => (
                <Fragment key={name}>
                  <Box className="layout-column tw:block">
                    <Divider
                      dashed
                      className="tw:mx-2 tw:h-6 tw:border-r"
                      orientation="vertical"
                    />
                  </Box>
                  <Box
                    className="layout-column tw:block"
                    style={{ maxWidth: '100%', flex: '0 0 100%' }}>
                    <Widget
                      alertDetails={alert}
                      loading={isLoading}
                      templateResourcePermission={templateResourcePermission}
                      templates={templates}
                      values={values}
                      onValuesChange={onValuesChange}
                    />
                  </Box>
                </Fragment>
              ))}
            </>
          )}
        </Box>
      </Grid.Item>
    </>
  );
}

export default ObservabilityAlertFormFields;
