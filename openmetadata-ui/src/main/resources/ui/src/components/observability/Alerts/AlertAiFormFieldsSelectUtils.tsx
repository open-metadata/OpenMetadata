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

import { Select, SelectItemType } from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';
import { isEmpty, isString, startCase } from 'lodash';
import {
  DATA_CONTRACT_STATUS_OPTIONS,
  EXTERNAL_CATEGORY_OPTIONS,
  INTERNAL_CATEGORY_OPTIONS,
} from '../../../constants/Alerts.constants';
import { StatusType } from '../../../generated/entity/data/pipeline';
import { NotificationTemplate } from '../../../generated/entity/events/notificationTemplate';
import { PipelineState } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Type } from '../../../generated/events/eventSubscription';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { EventType } from '../../../generated/type/changeEvent';
import {
  getSelectOptionsFromEnum,
  getSubscriptionTypeOptions,
} from '../../../utils/Alerts/AlertsUtilPure';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getAlertDestinationCategoryIcons } from '../../../utils/ObservabilityUtils';
import { getTemplateEntityRefObject } from './NotificationTemplateUtils';
import {
  CUSTOM_TEMPLATE_VALUE,
  SYSTEM_DEFAULT_TEMPLATES,
} from './Template.constants';

/** Renders Core UI select items with a stable text value for search and a11y. */
export const renderSelectItem = ({
  icon,
  id,
  isDisabled,
  label,
}: SelectItemType) => (
  <Select.Item
    icon={icon}
    id={id}
    isDisabled={isDisabled}
    key={id}
    textValue={label ?? id}>
    {label ?? id}
  </Select.Item>
);

/** Converts legacy AntD-style option objects to Core UI select items. */
export const toSelectItems = (
  options: Array<{ label: string; value: string }>
): SelectItemType[] =>
  options.map((option) => ({
    id: option.value,
    label: option.label,
  }));

export const INTERNAL_DESTINATION_ITEMS: SelectItemType[] =
  INTERNAL_CATEGORY_OPTIONS.map((option) => ({
    icon: getAlertDestinationCategoryIcons(String(option.value)),
    id: String(option.value),
    label: startCase(String(option.value)),
  }));

export const EXTERNAL_DESTINATION_ITEMS: SelectItemType[] =
  EXTERNAL_CATEGORY_OPTIONS.map((option) => ({
    icon: getAlertDestinationCategoryIcons(String(option.value)),
    id: String(option.value),
    label: startCase(String(option.value)),
  }));

export const getDestinationCategoryItems = (t: TFunction): SelectItemType[] => [
  {
    id: 'header-internal',
    isDisabled: true,
    label: t('label.internal'),
  },
  ...INTERNAL_DESTINATION_ITEMS,
  {
    id: 'header-external',
    isDisabled: true,
    label: t('label.external'),
  },
  ...EXTERNAL_DESTINATION_ITEMS,
];

export const getAuthTypeItems = (t: TFunction): SelectItemType[] => [
  { id: Type.None, label: t('label.no-authentication') },
  { id: Type.Bearer, label: t('label.bearer-hmac-signature') },
  { id: Type.Oauth2, label: t('label.oauth2-client-credential-plural') },
];

/** Builds subscription type options for the selected internal destination category. */
export const getSubscriptionItems = (destinationType?: string) =>
  getSubscriptionTypeOptions(destinationType ?? '').map((option) => ({
    id: String(option.value),
    isDisabled: option.disabled,
    label: isString(option.label)
      ? option.label
      : startCase(String(option.value)),
  }));

/** Provides Core UI select configuration for enum-backed alert rule arguments. */
export const getSelectArgumentConfig = (argument: string, t: TFunction) => {
  switch (argument) {
    case 'eventTypeList':
      return {
        items: toSelectItems(getSelectOptionsFromEnum(EventType)),
        label: t('label.event-type'),
        placeholder: t('label.search-by-type', {
          type: t('label.event-type-lowercase'),
        }),
      };
    case 'pipelineStateList':
      return {
        items: toSelectItems(getSelectOptionsFromEnum(StatusType)),
        label: t('label.pipeline-state'),
        placeholder: t('label.search-by-type', {
          type: t('label.pipeline-state'),
        }),
      };
    case 'ingestionPipelineStateList':
      return {
        items: toSelectItems(getSelectOptionsFromEnum(PipelineState)),
        label: t('label.pipeline-state'),
        placeholder: t('label.search-by-type', {
          type: t('label.pipeline-state'),
        }),
      };
    case 'testStatusList':
      return {
        items: toSelectItems(getSelectOptionsFromEnum(TestCaseStatus)),
        label: t('label.test-suite-status'),
        placeholder: t('label.search-by-type', {
          type: t('label.test-suite-status'),
        }),
      };
    case 'testResultList':
      return {
        items: toSelectItems(getSelectOptionsFromEnum(TestCaseStatus)),
        label: t('label.test-case-result'),
        placeholder: t('label.search-by-type', {
          type: t('label.test-case-result'),
        }),
      };
    case 'contractStatusList':
      return {
        items: toSelectItems(
          DATA_CONTRACT_STATUS_OPTIONS.map((option) => ({
            ...option,
            label: t(option.label),
          }))
        ),
        label: t('label.data-contract-status'),
        placeholder: t('label.search-by-type', {
          type: t('label.data-contract-status'),
        }),
      };
    default:
      return;
  }
};

/** Builds notification template options, including the selected template when it is not preloaded. */
export const getTemplateItems = (
  templates: NotificationTemplate[] | undefined,
  selectedTemplate: string | undefined,
  t: TFunction
) => {
  const items =
    templates?.map((template) => ({
      id: JSON.stringify(getTemplateEntityRefObject(template)),
      label: getEntityName(template),
    })) ?? [];

  if (
    isEmpty(templates) &&
    selectedTemplate &&
    ![CUSTOM_TEMPLATE_VALUE, SYSTEM_DEFAULT_TEMPLATES].includes(
      selectedTemplate
    )
  ) {
    try {
      const parsedTemplate = JSON.parse(selectedTemplate);
      items.push({
        id: selectedTemplate,
        label: parsedTemplate.displayName ?? parsedTemplate.name,
      });
    } catch {
      items.push({
        id: selectedTemplate,
        label: selectedTemplate,
      });
    }
  }

  return [
    ...items,
    {
      id: SYSTEM_DEFAULT_TEMPLATES,
      label: t('label.system-default-template'),
    },
    {
      id: CUSTOM_TEMPLATE_VALUE,
      label: t('label.create-entity', {
        entity: t('label.custom-template'),
      }),
    },
  ];
};
