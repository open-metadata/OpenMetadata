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
  Input,
  Select,
  Typography,
  useFieldDoc,
} from '@openmetadata/ui-core-components';
import { AlertCircle } from '@untitledui/icons';
import { NOTIFICATION_TEMPLATES_DOCS } from './alertFormDocs.constants';
import {
  CUSTOM_TEMPLATE_VALUE,
  SYSTEM_DEFAULT_TEMPLATES,
} from './Template.constants';
import { isEmpty } from 'lodash';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import RichTextEditorPreviewerV1 from '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { NotificationTemplateValidationResponse } from '../../../generated/api/events/notificationTemplateValidationResponse';
import { ModifiedCreateEventSubscription } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { validateNotificationTemplate } from '../../../rest/notificationtemplateAPI';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTemplateValidationAlert } from './NotificationTemplateUtils';
import { ALERT_AI_FORM_CLASS_NAMES } from './AlertAiFormFields.constants';
import { AlertAiNotificationSectionProps } from './AlertAiFormFields.interface';
import { updateAlertAiValue } from './AlertAiFormFieldsPureUtils';
import {
  getTemplateItems,
  renderSelectItem,
} from './AlertAiFormFieldsSelectUtils';
import {
  CUSTOM_TEMPLATE_FIELD_DOC_NAMES,
  CUSTOM_TEMPLATE_FIELD_NAMES,
  CustomTemplateErrors,
  CustomTemplateField,
  getCustomTemplateFieldData,
  getCustomTemplateFieldDocs,
  getCustomTemplateFieldLabels,
  getCustomTemplateRequiredErrors,
  getSelectedSavedTemplate,
  getSelectedTemplateKey,
} from './AlertAiNotificationTemplateUtils';
import AlertAiSection from './AlertAiSection.component';

/** Renders notification template selection and custom-template fields. */
const AlertAiNotificationSection = ({
  isViewOnly,
  onChange,
  templates,
  value,
}: AlertAiNotificationSectionProps) => {
  const { t } = useTranslation();
  const [customTemplateErrors, setCustomTemplateErrors] =
    useState<CustomTemplateErrors>({});
  const [validationResponse, setValidationResponse] =
    useState<NotificationTemplateValidationResponse>();
  const selectedTemplate = getSelectedTemplateKey(value.notificationTemplate);
  const customTemplateData =
    'customNotificationTemplateData' in value
      ? value.customNotificationTemplateData
      : undefined;
  const templateItems = useMemo(
    () => getTemplateItems(templates, selectedTemplate, t),
    [selectedTemplate, templates, t]
  );
  const isCustomTemplate = selectedTemplate === CUSTOM_TEMPLATE_VALUE;
  const selectedSavedTemplate = useMemo(
    () => getSelectedSavedTemplate(selectedTemplate, templates),
    [selectedTemplate, templates]
  );
  const templateFieldData = getCustomTemplateFieldData({
    customTemplateData,
    isCustomTemplate,
    selectedSavedTemplate,
  });
  const shouldRenderTemplateFields =
    isCustomTemplate || !isEmpty(selectedSavedTemplate);
  const areTemplateFieldsReadOnly = isViewOnly || !isCustomTemplate;
  const templateFieldLabels = useMemo(
    () => getCustomTemplateFieldLabels(t),
    [t]
  );
  const templateFieldDocs = useMemo(() => getCustomTemplateFieldDocs(), []);
  // Gated on the whole form being read-only, not on these fields being
  // read-only. Picking a saved template makes them read-only too, but the user
  // is still building an alert and the hint still explains what they are
  // looking at — suppressing it there left the panel showing the previous
  // field's doc, which reads as the hint being broken.
  //
  // Also gated on the fields existing: useFieldDoc registers on the doc alone,
  // not on anything being rendered, so without this the template docs join the
  // registry while their inputs are still hidden behind the template picker.
  const fieldDocEnabled = !isViewOnly && shouldRenderTemplateFields;

  const templateNameDoc = useFieldDoc({
    doc: fieldDocEnabled
      ? templateFieldDocs[CUSTOM_TEMPLATE_FIELD_NAMES.displayName]
      : undefined,
    label: templateFieldLabels.displayName,
    name: CUSTOM_TEMPLATE_FIELD_DOC_NAMES.displayName,
  });
  const templateSubjectDoc = useFieldDoc({
    doc: fieldDocEnabled
      ? templateFieldDocs[CUSTOM_TEMPLATE_FIELD_NAMES.templateSubject]
      : undefined,
    label: templateFieldLabels.templateSubject,
    name: CUSTOM_TEMPLATE_FIELD_DOC_NAMES.templateSubject,
  });
  const templateBodyDoc = useFieldDoc({
    doc: fieldDocEnabled
      ? templateFieldDocs[CUSTOM_TEMPLATE_FIELD_NAMES.templateBody]
      : undefined,
    label: templateFieldLabels.templateBody,
    name: CUSTOM_TEMPLATE_FIELD_DOC_NAMES.templateBody,
  });

  const getRequiredErrors = (): CustomTemplateErrors => {
    return getCustomTemplateRequiredErrors(customTemplateData, t);
  };

  /** Updates a single field inside the custom notification template payload. */
  const updateCustomTemplateField = (
    field: CustomTemplateField,
    nextValue: string
  ) => {
    setCustomTemplateErrors((prev) => ({ ...prev, [field]: undefined }));
    updateAlertAiValue(value, onChange, ['customNotificationTemplateData'], {
      ...customTemplateData,
      [field]: nextValue,
    });
  };

  const handleValidate = async () => {
    const nextErrors = getRequiredErrors();

    if (!isEmpty(nextErrors)) {
      setCustomTemplateErrors(nextErrors);
      setValidationResponse({
        bodyError: nextErrors.templateBody,
        isValid: false,
        subjectError: nextErrors.templateSubject,
      });

      return;
    }

    const templateSubject = customTemplateData?.templateSubject ?? '';
    const templateBody = customTemplateData?.templateBody ?? '';

    try {
      const response = await validateNotificationTemplate(
        templateSubject,
        templateBody
      );

      setValidationResponse(response);
      setCustomTemplateErrors({
        templateBody: response.bodyError as string,
        templateSubject: response.subjectError as string,
      });
    } catch {
      setValidationResponse(undefined);
    }
  };

  return (
    <AlertAiSection
      description={t('message.notification-template-description')}
      title={t('label.notification-template')}>
      <Box
        className={ALERT_AI_FORM_CLASS_NAMES.sectionCard}
        direction="col"
        gap={4}>
        <Select
          data-testid="template-select"
          fontSize="sm"
          isDisabled={isViewOnly}
          items={templateItems}
          label={t('label.notification-template')}
          placeholder={t('label.please-select-entity', {
            entity: t('label.notification-template'),
          })}
          selectedKey={selectedTemplate ?? SYSTEM_DEFAULT_TEMPLATES}
          size="sm"
          onSelectionChange={(key) => {
            const nextTemplate = key ? String(key) : SYSTEM_DEFAULT_TEMPLATES;

            onChange?.({
              ...value,
              customNotificationTemplateData:
                nextTemplate === CUSTOM_TEMPLATE_VALUE
                  ? customTemplateData
                  : undefined,
              notificationTemplate: nextTemplate,
            } as ModifiedCreateEventSubscription);
          }}>
          {renderSelectItem}
        </Select>
        {shouldRenderTemplateFields && (
          <div className={ALERT_AI_FORM_CLASS_NAMES.customTemplateFields}>
            {!areTemplateFieldsReadOnly && (
              <div
                className={ALERT_AI_FORM_CLASS_NAMES.customTemplateInfoBanner}
                data-testid="custom-template-info-banner">
                <AlertCircle
                  className="tw:mt-0.5 tw:shrink-0"
                  height={16}
                  width={16}
                />
                <Typography as="p" className="tw:text-sm tw:text-tertiary">
                  {t('message.notification-template-help-text')}{' '}
                  <a
                    className="tw:text-utility-blue-700 tw:no-underline hover:tw:text-utility-blue-600 hover:tw:underline"
                    href={NOTIFICATION_TEMPLATES_DOCS}
                    rel="noopener noreferrer"
                    target="_blank">
                    {t('label.view-documentation')}
                  </a>
                </Typography>
              </div>
            )}
            <div className={ALERT_AI_FORM_CLASS_NAMES.customTemplateFields}>
              <div className={ALERT_AI_FORM_CLASS_NAMES.customTemplateFields}>
                <div {...templateNameDoc}>
                  <Input
                    data-testid="custom-template-name-input"
                    hint={customTemplateErrors.displayName}
                    isDisabled={areTemplateFieldsReadOnly}
                    isInvalid={Boolean(customTemplateErrors.displayName)}
                    isRequired={!areTemplateFieldsReadOnly}
                    label={templateFieldLabels.displayName}
                    placeholder={templateFieldLabels.displayName}
                    size="sm"
                    validationBehavior="aria"
                    value={templateFieldData?.displayName ?? ''}
                    onChange={(value) =>
                      updateCustomTemplateField('displayName', value)
                    }
                  />
                </div>
                <div {...templateSubjectDoc}>
                  <Input
                    data-testid="custom-template-subject-input"
                    hint={customTemplateErrors.templateSubject}
                    isDisabled={areTemplateFieldsReadOnly}
                    isInvalid={Boolean(customTemplateErrors.templateSubject)}
                    isRequired={!areTemplateFieldsReadOnly}
                    label={templateFieldLabels.templateSubject}
                    placeholder={templateFieldLabels.templateSubject}
                    size="sm"
                    validationBehavior="aria"
                    value={templateFieldData?.templateSubject ?? ''}
                    onChange={(value) =>
                      updateCustomTemplateField('templateSubject', value)
                    }
                  />
                  {!areTemplateFieldsReadOnly && (
                    <Typography
                      as="p"
                      className={
                        ALERT_AI_FORM_CLASS_NAMES.customTemplateSubjectFooter
                      }>
                      {t('message.handlebar-helper-text')}
                    </Typography>
                  )}
                </div>
                <div
                  className={ALERT_AI_FORM_CLASS_NAMES.customTemplateFields}
                  {...templateBodyDoc}>
                  <Typography as="label" size="text-sm" weight="medium">
                    {templateFieldLabels.templateBody}
                    {!areTemplateFieldsReadOnly && (
                      <span
                        className={
                          ALERT_AI_FORM_CLASS_NAMES.sectionRequiredMarker
                        }>
                        *
                      </span>
                    )}
                  </Typography>
                  {areTemplateFieldsReadOnly ? (
                    <RichTextEditorPreviewerV1
                      className="bg-white p-md border rounded-4"
                      extensionOptions={{ enableHandlebars: true }}
                      markdown={templateFieldData?.templateBody ?? ''}
                    />
                  ) : (
                    <div
                      className={
                        ALERT_AI_FORM_CLASS_NAMES.customTemplateEditorFrame
                      }>
                      <RichTextEditor
                        className={
                          ALERT_AI_FORM_CLASS_NAMES.customTemplateBodyEditor
                        }
                        data-testid="custom-template-body-input"
                        extensionOptions={{ enableHandlebars: true }}
                        initialValue={customTemplateData?.templateBody ?? ''}
                        key={selectedTemplate ?? CUSTOM_TEMPLATE_VALUE}
                        onTextChange={(value) =>
                          updateCustomTemplateField('templateBody', value)
                        }
                      />
                      <div
                        className="validate-button-container"
                        data-testid="custom-template-validate-container">
                        <div className="validate-button-grid tw:flex tw:items-center tw:justify-between tw:pr-3">
                          <div className="tw:flex tw:items-center tw:gap-2 tw:p-3">
                            <AlertCircle height={14} width={14} />
                            <Typography
                              as="p"
                              className="tw:text-sm tw:font-medium">
                              {t('label.validate-template-syntax')}
                            </Typography>
                          </div>
                          <Button
                            className="tw:text-utility-blue-700! tw:no-underline! tw:hover:text-utility-blue-600!"
                            color="link-color"
                            data-testid="custom-template-validate-button"
                            size="sm"
                            type="button"
                            onPress={handleValidate}>
                            {t('label.validate')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {!areTemplateFieldsReadOnly && (
                    <>
                      <Typography
                        as="p"
                        className="tw:text-sm tw:text-gray-500">
                        {t('message.handlebar-helper-text')}
                      </Typography>
                      {customTemplateErrors.templateBody && (
                        <Typography
                          as="p"
                          className={
                            ALERT_AI_FORM_CLASS_NAMES.customTemplateFieldError
                          }>
                          {customTemplateErrors.templateBody}
                        </Typography>
                      )}
                    </>
                  )}
                  <div className="tw:mt-2">
                    {getTemplateValidationAlert(validationResponse)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Box>
    </AlertAiSection>
  );
};

export default AlertAiNotificationSection;
