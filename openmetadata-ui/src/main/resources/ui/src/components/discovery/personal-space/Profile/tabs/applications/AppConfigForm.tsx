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
  Card,
  FieldDocPopover,
  FieldDocProvider,
  Toggle,
  Typography,
  useFieldDoc,
} from '@openmetadata/ui-core-components';
import { Hint } from '@openmetadata/ui-core-components/icons';
import { IChangeEvent } from '@rjsf/core';
import { FieldProps, FieldTemplateProps, RJSFSchema } from '@rjsf/utils';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { App } from '../../../../../../generated/entity/applications/app';
import { AppMarketPlaceDefinition } from '../../../../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { EntityReference } from '../../../../../../generated/entity/type';
import { formatFormDataForSubmit } from '../../../../../../utils/JSONSchemaFormUtils';
import FormBuilderV1 from '../../../../../common/FormBuilderV1/FormBuilderV1';
import { getFormDisplayLabel } from '../../../../../common/FormBuilderV1/formBuilderV1LabelUtils';
import { CoreFieldTemplate } from '../../../../../common/FormBuilderV1/templates/CoreFieldTemplate';
import applicationsClassBase from '../../../../../Settings/Applications/AppDetails/ApplicationsClassBase';
import { useFormFieldDocs } from '../platform-settings/useFormFieldDocs';
import { AppFooter } from './AppFooter';

export interface AppConfigFormProps {
  appData: App | AppMarketPlaceDefinition;
  jsonSchema: RJSFSchema;
  showHint: boolean;
  isSaving: boolean;
  submitLabel: string;
  cancelLabel?: string;
  /** Render the form without edit controls (user lacks edit permission). */
  isReadOnly?: boolean;
  onCancel?: () => void;
  onSave: (data: {
    formData: Record<string, unknown>;
    ingestionRunner?: EntityReference;
  }) => void | Promise<void>;
}

interface AppFormContext {
  fieldDocs?: Record<string, string>;
  /** Drops the template's tinted section fill so the form sits flat on the page. */
  flatPropertyLayout: true;
}

const getFieldName = (id: string) => id.split('/').pop() ?? '';

export const HintToggle: FC<{
  isSelected: boolean;
  onChange: (value: boolean) => void;
}> = ({ isSelected, onChange }) => {
  const { t } = useTranslation();

  return (
    <Box align="center" direction="row" gap={2}>
      <Hint className="tw:size-4.5 tw:text-secondary" />
      <Typography size="text-sm" weight="medium">
        {t('label.show-hint')}
      </Typography>
      <Toggle
        aria-label={t('label.show-hint')}
        data-testid="show-hint-toggle"
        isSelected={isSelected}
        onChange={onChange}
      />
    </Box>
  );
};

/** Booleans render as a full-width card: label and description left, toggle right. */
export const AppToggleCardField = ({
  idSchema,
  name,
  schema,
  formData,
  disabled,
  readonly,
  onChange,
}: FieldProps) => {
  const label = schema.title ?? getFormDisplayLabel(name);

  return (
    <Card data-testid={`toggle-card-${getFieldName(idSchema.$id)}`} size="sm">
      <Card.Content>
        <Box align="center" direction="row" gap={4} justify="between">
          <Box className="tw:min-w-0" direction="col">
            <Typography
              className="tw:text-primary"
              size="text-sm"
              weight="medium">
              {label}
            </Typography>
            {schema.description && (
              <Typography className="tw:text-tertiary" size="text-sm">
                {schema.description}
              </Typography>
            )}
          </Box>
          <Toggle
            aria-label={label}
            isDisabled={disabled || readonly}
            isSelected={Boolean(formData)}
            onChange={onChange}
          />
        </Box>
      </Card.Content>
    </Card>
  );
};

/** Registers each field's markdown hint so the header "Show hint" toggle can surface it. */
const AppFieldTemplate = (props: FieldTemplateProps) => {
  const name = getFieldName(props.id);
  const { fieldDocs } = (props.registry.formContext ?? {}) as AppFormContext;
  const fieldDoc = useFieldDoc({
    name: props.id,
    label: props.schema.title ?? getFormDisplayLabel(name),
    doc: props.id === 'root' ? undefined : fieldDocs?.[name],
  });

  return (
    <Box {...fieldDoc} direction="col">
      <CoreFieldTemplate {...props} />
    </Box>
  );
};

const APP_CONFIG_FORM_ID = 'app-config-form';
const APP_FORM_FIELDS = { BooleanField: AppToggleCardField };
const APP_FORM_TEMPLATES = { FieldTemplate: AppFieldTemplate };

const AppConfigForm: FC<AppConfigFormProps> = ({
  appData,
  jsonSchema,
  showHint,
  isSaving,
  submitLabel,
  cancelLabel,
  isReadOnly = false,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const fieldDocs = useFormFieldDocs(appData.name, 'Applications');
  const formContext = useMemo<AppFormContext>(
    () => ({ fieldDocs, flatPropertyLayout: true }),
    [fieldDocs]
  );
  // A fresh `{}` each render would make FormBuilderV1 reset the user's edits.
  const formData = useMemo(
    () => appData.appConfiguration ?? {},
    [appData.appConfiguration]
  );

  const handleSubmit = (event: IChangeEvent) =>
    onSave({ formData: formatFormDataForSubmit(event.formData) });

  return (
    <FieldDocProvider enabled={showHint}>
      <FormBuilderV1
        hideFooter
        fields={APP_FORM_FIELDS}
        formContext={formContext}
        formData={formData}
        id={APP_CONFIG_FORM_ID}
        readonly={isReadOnly}
        schema={jsonSchema}
        templates={APP_FORM_TEMPLATES}
        uiSchema={applicationsClassBase.getJSONUISchema()}
        onSubmit={handleSubmit}
      />
      {!isReadOnly && (
        <AppFooter testId="app-config-footer">
          {onCancel && (
            <Button
              color="tertiary"
              data-testid="cancel-button"
              isDisabled={isSaving}
              onPress={onCancel}>
              {cancelLabel ?? t('label.cancel')}
            </Button>
          )}
          <Button
            color="primary"
            data-testid="save-button"
            form={APP_CONFIG_FORM_ID}
            isLoading={isSaving}
            type="submit">
            {submitLabel}
          </Button>
        </AppFooter>
      )}
      {/* Full-width fields leave no room beside them, so the hint opens above. */}
      <FieldDocPopover placement="top end" />
    </FieldDocProvider>
  );
};

export default AppConfigForm;
