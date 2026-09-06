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
  Input,
  Select,
  TextArea,
  useFieldDoc,
} from '@openmetadata/ui-core-components';
import { isEmpty, isUndefined } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import InlineAlert from '../../../components/common/InlineAlert/InlineAlert';
import { loadFormFieldDocs } from '../../../utils/DataQuality/FormFieldDocs';
import AlertAiDestinationSection from './AlertAiDestinationSection.component';
import {
  ALERT_AI_DESCRIPTION_TEXT_AREA_ROWS,
  ALERT_AI_FORM_CLASS_NAMES,
} from './AlertAiFormFields.constants';
import { AlertAiFormFieldsProps } from './AlertAiFormFields.interface';
import {
  getAlertAiResources,
  getAlertAiSectionVisibility,
  updateAlertAiValue,
} from './AlertAiFormFieldsPureUtils';
import { getAlertAiSourceItems } from './AlertAiFormFieldsSearchUtils';
import { renderSelectItem } from './AlertAiFormFieldsSelectUtils';
import AlertAiNotificationSection from './AlertAiNotificationSection.component';
import AlertAiRuleSection from './AlertAiRuleSection.component';
import AlertAiSection from './AlertAiSection.component';
import { OBSERVABILITY_ALERT_FORM } from './alertFormDocs.constants';

/** Coordinates the AI alert form sections for add/edit and read-only configuration views. */
function AlertAiFormFields({
  alert,
  containerEntities,
  filterResources,
  isViewOnly,
  inlineAlert,
  onChange,
  showBasicFields = true,
  shouldShowActionsSection,
  shouldShowFiltersSection,
  supportedFilters,
  supportedTriggers,
  templates,
  validationErrors,
  value,
}: Readonly<AlertAiFormFieldsProps>) {
  const { t } = useTranslation();
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

  const [selectedSource] = getAlertAiResources(value, alert);
  const selectedFilters = value.input?.filters ?? [];
  const selectedTriggers = value.input?.actions ?? [];
  const sourceItems = useMemo(
    () => getAlertAiSourceItems(filterResources, selectedSource),
    [filterResources, selectedSource]
  );
  const selectedFilterResource = useMemo(
    () => filterResources.find((resource) => resource.name === selectedSource),
    [filterResources, selectedSource]
  );
  const selectedSupportedFilters =
    selectedFilterResource?.supportedFilters ?? supportedFilters;
  const selectedSupportedTriggers =
    selectedFilterResource?.supportedActions ?? supportedTriggers;
  const shouldDisplayFiltersSection = selectedSource
    ? !isEmpty(selectedSupportedFilters)
    : shouldShowFiltersSection;
  const shouldDisplayActionsSection = selectedSource
    ? !isEmpty(selectedSupportedTriggers)
    : shouldShowActionsSection;
  const {
    shouldRenderActionsSection,
    shouldRenderFiltersSection,
    shouldRenderSourceSection,
  } = getAlertAiSectionVisibility({
    isViewOnly,
    selectedFilters,
    selectedSource,
    selectedTriggers,
    shouldShowActionsSection: shouldDisplayActionsSection,
    shouldShowFiltersSection: shouldDisplayFiltersSection,
  });

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
    doc: docFor('notificationTemplate'),
    label: t('label.notification-template'),
    name: 'alertNotificationTemplate',
  });

  /** Resets dependent rule and destination state when the alert source changes. */
  const handleSourceChange = (key: Key | null) => {
    const nextSource = key ? String(key) : '';

    if (!onChange) {
      return;
    }

    onChange({
      ...(value as Parameters<NonNullable<typeof onChange>>[0]),
      input: {},
      destinations: [],
      resources: nextSource ? [nextSource] : [],
    });
  };

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
            <Select
              isRequired
              data-testid="source-select"
              fontSize="sm"
              hint={validationErrors?.resources}
              isDisabled={isViewOnly}
              isInvalid={Boolean(validationErrors?.resources)}
              items={sourceItems}
              placeholder={t('label.select-field', {
                field: t('label.data-asset-plural'),
              })}
              selectedKey={selectedSource ?? null}
              size="sm"
              validationBehavior="aria"
              onSelectionChange={handleSourceChange}>
              {renderSelectItem}
            </Select>
          </AlertAiSection>
        </div>
      )}

      {shouldRenderFiltersSection && (
        <div {...filtersDoc}>
          <AlertAiRuleSection
            containerEntities={containerEntities}
            field="filters"
            isViewOnly={isViewOnly}
            selectedSource={selectedSource}
            supportedRules={selectedSupportedFilters}
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
            containerEntities={containerEntities}
            field="actions"
            isViewOnly={isViewOnly}
            selectedSource={selectedSource}
            supportedRules={selectedSupportedTriggers}
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
          selectedSource={selectedSource}
          validationErrors={validationErrors}
          value={value}
          onChange={onChange}
        />
      </div>

      <div {...notificationTemplateDoc}>
        <AlertAiNotificationSection
          isViewOnly={isViewOnly}
          templates={templates}
          value={value}
          onChange={onChange}
        />
      </div>

      {!isUndefined(inlineAlert) && <InlineAlert {...inlineAlert} />}
    </Box>
  );
}

export default AlertAiFormFields;
