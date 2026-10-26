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
  Alert,
  Box,
  Input,
  TextArea,
  useFieldDoc,
} from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { ComponentType, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AlertSourcePicker from '../../../components/Alerts/AlertSourcePicker/AlertSourcePicker';
import InlineAlert from '../../../components/common/InlineAlert/InlineAlert';
import { getAlertSourceChanges } from '../../../utils/Alerts/AlertSelectionUtil';
import alertsClassBase, {
  AlertAiTemplateSectionProps,
} from '../../../utils/AlertsClassBase';
import { loadFormFieldDocs } from '../../../utils/DataQuality/FormFieldDocs';
import AlertAiDestinationSection from './AlertAiDestinationSection.component';
import {
  ALERT_AI_DESCRIPTION_TEXT_AREA_ROWS,
  ALERT_AI_FORM_CLASS_NAMES,
} from './AlertAiFormFields.constants';
import { AlertAiFormFieldsProps } from './AlertAiFormFields.interface';
import {
  getAlertAiResources,
  getAlertAiSectionInputs,
  getAlertAiSectionVisibility,
  updateAlertAiValue,
} from './AlertAiFormFieldsPureUtils';
import AlertAiRuleSection from './AlertAiRuleSection.component';
import AlertAiSection from './AlertAiSection.component';
import { OBSERVABILITY_ALERT_FORM } from './alertFormDocs.constants';

/**
 * The notification template section comes from `alertsClassBase` (Collate);
 * OSS has none. Kept as its own component so the condition does not push
 * AlertAiFormFields over the cyclomatic-complexity limit.
 */
const AlertAiTemplateField = ({
  docProps,
  TemplateSection,
  ...sectionProps
}: AlertAiTemplateSectionProps & {
  docProps: ReturnType<typeof useFieldDoc>;
  TemplateSection: ComponentType<AlertAiTemplateSectionProps> | null;
}) =>
  TemplateSection ? (
    <div {...docProps}>
      <TemplateSection {...sectionProps} />
    </div>
  ) : null;

/** Says why an editable form lists rules it cannot change. */
const ReadOnlyRulesNotice = ({
  alert,
  hasActionsSection,
  hasFiltersSection,
  isViewOnly,
}: Pick<AlertAiFormFieldsProps, 'alert' | 'isViewOnly'> & {
  hasActionsSection: boolean;
  hasFiltersSection: boolean;
}) => {
  const { t } = useTranslation();
  const isShown =
    !isViewOnly &&
    alert?.hasRulesWithoutSelections &&
    (hasFiltersSection || hasActionsSection);

  return isShown ? (
    <Alert
      data-testid="alert-rules-read-only"
      title={t('message.alert-rules-read-only')}
      variant="brand"
    />
  ) : null;
};

/** Coordinates the AI alert form sections for add/edit and read-only configuration views. */
function AlertAiFormFields({
  alert,
  isViewOnly,
  inlineAlert,
  onChange,
  selection,
  showBasicFields = true,
  shouldShowActionsSection,
  shouldShowFiltersSection,
  templateResourcePermission,
  templates,
  templatesLoading,
  validationErrors,
  value,
}: Readonly<AlertAiFormFieldsProps>) {
  const { t } = useTranslation();
  const TemplateSection = useMemo(
    () => alertsClassBase.getAlertAiTemplateSection(),
    []
  );
  // Field docs for the Form Hint panel, sourced from ObservabilityAlertForm.md
  // (same markdown-backed mechanism the Data Quality forms use). Docs are
  // suppressed in the read-only configuration view, where there is nothing to
  // fill in.
  const [fieldDocs, setFieldDocs] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    loadFormFieldDocs(OBSERVABILITY_ALERT_FORM).then((docs) => {
      if (!cancelled) {
        setFieldDocs(docs);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSources = getAlertAiResources(value, alert);
  const { capabilities, search, support } = selection;
  const {
    selectedFilters,
    selectedTriggers,
    shouldDisplayFiltersSection,
    shouldDisplayActionsSection,
  } = getAlertAiSectionInputs({
    value,
    isViewOnly,
    selectedSources,
    hasFilters: support.hasFilters,
    hasTriggers: support.hasTriggers,
    shouldShowActionsSection,
    shouldShowFiltersSection,
  });
  const {
    shouldRenderActionsSection,
    shouldRenderFiltersSection,
    shouldRenderSourceSection,
  } = getAlertAiSectionVisibility({
    isViewOnly,
    selectedFilters,
    selectedSources,
    selectedTriggers,
    shouldShowActionsSection: shouldDisplayActionsSection,
    shouldShowFiltersSection: shouldDisplayFiltersSection,
  });

  const areRulesReadOnly = isViewOnly || alert?.hasRulesWithoutSelections;

  // `rendered` gates registration on the section actually being on screen.
  // useFieldDoc registers on the doc alone, so without it a source with no
  // supported filters would still put a Filters entry in the registry, with no
  // element for the panel to key off. Section visibility is therefore computed
  // above these hooks rather than below them.
  const docFor = (field: string, rendered = true) =>
    isViewOnly || !rendered ? undefined : fieldDocs[field];

  const nameDoc = useFieldDoc({
    doc: docFor('name', showBasicFields),
    label: t('label.name'),
    name: 'alertName',
  });
  const descriptionDoc = useFieldDoc({
    doc: docFor('description', showBasicFields),
    label: t('label.description'),
    name: 'alertDescription',
  });
  const sourceDoc = useFieldDoc({
    doc: docFor('source', shouldRenderSourceSection),
    label: t('label.source'),
    name: 'alertSource',
  });
  const filtersDoc = useFieldDoc({
    doc: docFor('filters', shouldRenderFiltersSection),
    label: t('label.filter-plural'),
    name: 'alertFilters',
  });
  const triggerDoc = useFieldDoc({
    doc: docFor('trigger', shouldRenderActionsSection),
    label: t('label.trigger'),
    name: 'alertTrigger',
  });
  const destinationsDoc = useFieldDoc({
    doc: docFor('destinations'),
    label: t('label.destination'),
    name: 'alertDestinations',
  });
  const notificationTemplateDoc = useFieldDoc({
    doc: docFor('notificationTemplate', Boolean(TemplateSection)),
    label: t('label.notification-template'),
    name: 'alertNotificationTemplate',
  });

  /** Applies the rule every alert form follows when its sources change. */
  const handleSourceChange = (next: string[], previous: string[]) =>
    onChange?.((prev) => ({
      ...prev,
      ...getAlertSourceChanges(
        next,
        previous,
        alert?.hasRulesWithoutSelections
      ),
    }));

  return (
    <Box className={ALERT_AI_FORM_CLASS_NAMES.formStack} direction="col">
      {showBasicFields && (
        <>
          <div {...nameDoc}>
            <Input
              isRequired
              data-testid="alert-name-input"
              hint={validationErrors?.displayName}
              isDisabled={isViewOnly}
              isInvalid={Boolean(validationErrors?.displayName)}
              label={t('label.name')}
              placeholder={t('label.name')}
              size="sm"
              validationBehavior="aria"
              value={value.displayName ?? value.name ?? ''}
              onChange={(nextValue) =>
                updateAlertAiValue(value, onChange, ['displayName'], nextValue)
              }
            />
          </div>
          <div {...descriptionDoc}>
            <AlertAiSection title={t('label.description')}>
              <TextArea
                data-testid="description"
                isDisabled={isViewOnly}
                placeholder={t('label.description')}
                rows={ALERT_AI_DESCRIPTION_TEXT_AREA_ROWS}
                size="sm"
                textAreaClassName={
                  ALERT_AI_FORM_CLASS_NAMES.descriptionTextArea
                }
                value={value.description ?? ''}
                onChange={(nextValue) =>
                  updateAlertAiValue(
                    value,
                    onChange,
                    ['description'],
                    nextValue
                  )
                }
              />
            </AlertAiSection>
          </div>
        </>
      )}
      {shouldRenderSourceSection && (
        <div {...sourceDoc}>
          <AlertAiSection
            description={t('message.alerts-source-description')}
            isRequired={!isViewOnly}
            title={t('label.source')}>
            <AlertSourcePicker
              isRequired
              capabilities={capabilities}
              hint={validationErrors?.resources}
              isDisabled={isViewOnly}
              isInvalid={Boolean(validationErrors?.resources)}
              value={selectedSources}
              onChange={handleSourceChange}
            />
          </AlertAiSection>
        </div>
      )}

      <ReadOnlyRulesNotice
        alert={alert}
        hasActionsSection={shouldRenderActionsSection}
        hasFiltersSection={shouldRenderFiltersSection}
        isViewOnly={isViewOnly}
      />

      {shouldRenderFiltersSection && (
        <div {...filtersDoc}>
          <AlertAiRuleSection
            field="filters"
            isViewOnly={areRulesReadOnly}
            selectedSources={selectedSources}
            sourceSearch={search}
            supportedEventTypes={support.supportedEventTypes}
            supportedRules={support.supportedFilters}
            title={t('label.filter-plural')}
            validationErrors={validationErrors}
            value={value}
            onChange={onChange}
          />
        </div>
      )}

      {shouldRenderActionsSection && (
        <div {...triggerDoc}>
          <AlertAiRuleSection
            field="actions"
            isViewOnly={areRulesReadOnly}
            selectedSources={selectedSources}
            sourceSearch={search}
            supportedRules={support.supportedTriggers}
            title={t('label.trigger')}
            validationErrors={validationErrors}
            value={value}
            onChange={onChange}
          />
        </div>
      )}

      <div {...destinationsDoc}>
        <AlertAiDestinationSection
          isViewOnly={isViewOnly}
          recipientCategories={support.recipientCategories}
          selectedSources={selectedSources}
          validationErrors={validationErrors}
          value={value}
          onChange={onChange}
        />
      </div>

      <AlertAiTemplateField
        TemplateSection={TemplateSection}
        docProps={notificationTemplateDoc}
        isViewOnly={isViewOnly}
        loading={templatesLoading}
        templateResourcePermission={templateResourcePermission}
        templates={templates}
        value={value}
        onChange={onChange}
      />

      {!isUndefined(inlineAlert) && <InlineAlert {...inlineAlert} />}
    </Box>
  );
}

export default AlertAiFormFields;
