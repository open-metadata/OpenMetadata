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

import { TFunction } from 'i18next';
import { isEmpty } from 'lodash';
import { EXTERNAL_CATEGORY_OPTIONS } from '../../../constants/Alerts.constants';
import {
  ArgumentsInput,
  Effect,
  EventFilterRule,
  InputType,
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
} from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { ALERT_AI_DEFAULT_DOWNSTREAM_DEPTH } from './AlertAiFormFields.constants';
import {
  AlertAiFormFieldsProps,
  AlertAiFormValue,
  RuleSectionField,
} from './AlertAiFormFields.interface';

export type WebhookDestinationType =
  | SubscriptionType.Slack
  | SubscriptionType.MSTeams
  | SubscriptionType.GChat
  | SubscriptionType.Webhook;

/** Returns true when a destination type belongs to the internal subscription categories. */
export const isInternalDestination = (destinationType?: string) =>
  Boolean(destinationType) &&
  Object.values(SubscriptionCategory).includes(
    destinationType as SubscriptionCategory
  ) &&
  destinationType !== SubscriptionCategory.External;

/** Narrows destination types that require webhook-style configuration fields. */
export const isWebhookDestination = (
  destinationType?: string
): destinationType is WebhookDestinationType =>
  destinationType === SubscriptionType.Slack ||
  destinationType === SubscriptionType.MSTeams ||
  destinationType === SubscriptionType.GChat ||
  destinationType === SubscriptionType.Webhook;

/** Normalizes API string/string-array values into arrays for multi-value inputs. */
export const getStringArrayValue = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
};

/** Splits comma-separated text input into the string-array payload expected by alert rules. */
export const getCommaSeparatedStringArray = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** Builds a path to an alert rule argument field inside the nested form value. */
export const getArgumentPath = (
  field: 'actions' | 'filters',
  name: number,
  index: number,
  key: 'input' | 'name'
) => ['input', field, name, 'arguments', index, key];

/** Builds a stable validation-error key for nested alert form fields. */
export const getValidationPath = (...path: (string | number)[]) =>
  path.join('.');

/** Converts string-array rule values into display text for Core UI inputs. */
export const getCommaSeparatedValues = (value?: string | string[]) =>
  Array.isArray(value) ? value.join(', ') : value ?? '';

/** Normalizes scalar or array values for Core UI multi-select selected item state. */
export const getListValue = (value?: string | string[]) =>
  getStringArrayValue(value);

/** Reads the selected alert source from create/edit form values or existing alert details. */
export const getAlertAiResources = (
  value: AlertAiFormValue,
  alert?: AlertAiFormFieldsProps['alert']
) => {
  if ('resources' in value && value.resources) {
    return value.resources;
  }

  if (alert?.filteringRules?.resources) {
    return alert.filteringRules.resources;
  }

  return 'filteringRules' in value ? value.filteringRules?.resources ?? [] : [];
};

/** Computes which configuration sections should render in edit and read-only modes. */
export const getAlertAiSectionVisibility = ({
  isViewOnly,
  selectedFilters,
  selectedSource,
  selectedTriggers,
  shouldShowActionsSection,
  shouldShowFiltersSection,
}: {
  isViewOnly?: boolean;
  selectedFilters: ArgumentsInput[];
  selectedSource?: string;
  selectedTriggers: ArgumentsInput[];
  shouldShowActionsSection: boolean;
  shouldShowFiltersSection: boolean;
}) => ({
  shouldRenderActionsSection:
    shouldShowActionsSection && (!isViewOnly || !isEmpty(selectedTriggers)),
  shouldRenderFiltersSection:
    shouldShowFiltersSection && (!isViewOnly || !isEmpty(selectedFilters)),
  shouldRenderSourceSection: !isViewOnly || !isEmpty(selectedSource),
});

/** Returns a cloned form value with a nested path updated, creating containers as needed. */
export const setValueAtPath = (
  source: AlertAiFormValue,
  path: (string | number)[],
  nextValue: unknown
): AlertAiFormValue => {
  const clone = structuredClone(source);
  let current: Record<string, unknown> | unknown[] = clone as unknown as Record<
    string,
    unknown
  >;

  path.forEach((pathItem, index) => {
    if (index === path.length - 1) {
      (current as Record<string | number, unknown>)[pathItem] = nextValue;

      return;
    }

    const nextPathItem = path[index + 1];
    const currentValue = (current as Record<string | number, unknown>)[
      pathItem
    ];

    if (currentValue === undefined || currentValue === null) {
      (current as Record<string | number, unknown>)[pathItem] =
        typeof nextPathItem === 'number' ? [] : {};
    }

    current = (current as Record<string | number, unknown>)[pathItem] as
      | Record<string, unknown>
      | unknown[];
  });

  return clone;
};

/** Applies an immutable nested update and emits the create-alert form value shape. */
export const updateAlertAiValue = (
  value: AlertAiFormValue,
  onChange: AlertAiFormFieldsProps['onChange'] | undefined,
  path: (string | number)[],
  nextValue: unknown
) => {
  onChange?.(
    setValueAtPath(value, path, nextValue) as ModifiedCreateEventSubscription
  );
};

/** Provides label and placeholder copy for text-based alert rule arguments. */
export const getTextArgumentCopy = (argument: string, t: TFunction) => {
  switch (argument) {
    case 'domainList':
      return {
        label: t('label.domain'),
        placeholder: t('label.search-by-type', {
          type: t('label.domain-lowercase'),
        }),
      };
    case 'fqnList':
      return {
        label: t('label.fqn-uppercase'),
        placeholder: t('label.search-by-type', {
          type: t('label.fqn-uppercase'),
        }),
      };
    case 'tableNameList':
      return {
        label: t('label.table'),
        placeholder: t('label.search-by-type', {
          type: t('label.table-lowercase'),
        }),
      };
    case 'ownerNameList':
      return {
        label: t('label.owner'),
        placeholder: t('label.search-by-type', {
          type: t('label.owner-lowercase-plural'),
        }),
      };
    case 'updateByUserList':
    case 'userList':
      return {
        label: t('label.user'),
        placeholder: t('label.search-by-type', {
          type: t('label.user'),
        }),
      };
    case 'entityIdList':
      return {
        label: t('label.entity-id', { entity: t('label.data-asset') }),
        placeholder: t('label.search-by-type', {
          type: t('label.entity-id', { entity: t('label.data-asset') }),
        }),
      };
    case 'testSuiteList':
      return {
        label: t('label.test-suite'),
        placeholder: t('label.search-by-type', {
          type: t('label.test-suite'),
        }),
      };
    case 'entityNameList':
    default:
      return {
        label: t('label.entity'),
        placeholder: t('label.search-by-type', {
          type: t('label.entity-lowercase'),
        }),
      };
  }
};

/** Builds rule dropdown items and disables rules that are already selected. */
export const getRuleItems = (
  supportedRules: EventFilterRule[] | undefined,
  selectedRules: ArgumentsInput[]
) =>
  supportedRules
    ?.filter((rule): rule is EventFilterRule & { name: string } =>
      Boolean(rule.name)
    )
    .map((rule) => ({
      id: rule.name,
      isDisabled: selectedRules.some(
        (selectedRule) => selectedRule.name === rule.name
      ),
      label: rule.displayName ?? rule.name,
    })) ?? [];

/** Returns translated copy used by filter and trigger rule sections. */
export const getRuleCopy = (field: RuleSectionField, t: TFunction) => {
  const label = field === 'filters' ? t('label.filter') : t('label.trigger');

  return {
    description:
      field === 'filters'
        ? t('message.alerts-filter-description')
        : t('message.alerts-trigger-description'),
    label,
    placeholder: t('label.select-field', { field: label }),
  };
};

/** Resolves argument names to render for a selected rule, using descriptors when runtime input is required. */
export const getRuntimeArguments = (
  selectedRule: ArgumentsInput | undefined,
  supportedRules: EventFilterRule[] | undefined
) => {
  const selectedRuleConfig = supportedRules?.find(
    (rule) => rule.name === selectedRule?.name
  );

  return selectedRuleConfig?.inputType === InputType.Runtime
    ? selectedRuleConfig.arguments ?? []
    : selectedRule?.arguments
        ?.map((argument) => argument.name)
        .filter((argument): argument is string => Boolean(argument)) ?? [];
};

/** Returns selected rules with one rule name changed and its argument skeleton reset. */
export const getRulesWithName = ({
  index,
  ruleName,
  selectedRules,
  supportedRules,
}: {
  index: number;
  ruleName: string;
  selectedRules: ArgumentsInput[];
  supportedRules?: EventFilterRule[];
}) => {
  const nextRules = [...selectedRules];
  nextRules[index] = {
    ...nextRules[index],
    arguments: supportedRules
      ?.find((rule) => rule.name === ruleName)
      ?.arguments?.map((argument) => ({ input: [], name: argument })),
    name: ruleName,
  };

  return nextRules;
};

/** Returns selected rules with one include/exclude effect changed. */
export const getRulesWithEffect = (
  selectedRules: ArgumentsInput[],
  index: number,
  isIncluded: boolean
) => {
  const nextRules = [...selectedRules];
  nextRules[index] = {
    ...nextRules[index],
    effect: isIncluded ? Effect.Include : Effect.Exclude,
  };

  return nextRules;
};

/** Appends a new include rule placeholder. */
export const getRulesWithAddedRule = (selectedRules: ArgumentsInput[]) => [
  ...selectedRules,
  { effect: Effect.Include },
];

/** Removes a rule by index from the selected rules array. */
export const getRulesWithoutIndex = (
  selectedRules: ArgumentsInput[],
  index: number
) => selectedRules.filter((_, ruleIndex) => ruleIndex !== index);

/** Checks whether there is at least one configured external destination to test. */
export const hasExternalDestinationConfig = (
  destinations: ModifiedDestination[]
) =>
  destinations.some(
    (destination) =>
      destination.category === SubscriptionCategory.External &&
      EXTERNAL_CATEGORY_OPTIONS.some((item) => item.value === destination.type)
  );

/** Creates the destination payload update when the destination category dropdown changes. */
export const getDestinationTypeUpdate = (
  destination: ModifiedDestination,
  nextDestinationType: string
): ModifiedDestination => {
  if (nextDestinationType.startsWith('header-')) {
    return destination;
  }

  const isInternalDestinationType = isInternalDestination(nextDestinationType);
  const destinationType = nextDestinationType as
    | SubscriptionCategory
    | SubscriptionType;
  const nextDestination: Omit<ModifiedDestination, 'type'> & {
    type?: SubscriptionType;
  } = {
    ...destination,
    category: isInternalDestinationType
      ? (nextDestinationType as SubscriptionCategory)
      : SubscriptionCategory.External,
    destinationType,
  };

  if (!isInternalDestinationType) {
    nextDestination.type = nextDestinationType as SubscriptionType;
  }

  return nextDestination as ModifiedDestination;
};

/** Toggles notify-downstream while keeping downstream depth consistent with OSS defaults. */
export const getDestinationWithNotifyDownstream = (
  destination: ModifiedDestination,
  notifyDownstream: boolean
): ModifiedDestination => ({
  ...destination,
  downstreamDepth: notifyDownstream
    ? destination?.downstreamDepth ?? ALERT_AI_DEFAULT_DOWNSTREAM_DEPTH
    : undefined,
  notifyDownstream,
});
