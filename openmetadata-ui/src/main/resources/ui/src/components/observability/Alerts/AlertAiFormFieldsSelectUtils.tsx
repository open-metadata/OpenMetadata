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
import { DATA_CONTRACT_STATUS_OPTIONS } from '../../../constants/Alerts.constants';
import { StatusType } from '../../../generated/entity/data/pipeline';
import { PipelineState } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Type } from '../../../generated/events/eventSubscription';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { EventType } from '../../../generated/type/changeEvent';
import {
  getSelectOptionsFromEnum,
  getSelectOptionsFromValues,
  getSubscriptionTypeOptions,
} from '../../../utils/Alerts/AlertsUtilPure';
import { buildGroupedOptions } from '../../Alerts/DestinationFormItem/DestinationSelectItem/DestinationSelectItem.utils';

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

/**
 * The same categories as the classic `DestinationSelectItem`: the internal ones the server offers
 * for the selected sources, with the one a destination already has, and every external one.
 */
export const getDestinationCategoryItems = (
  t: TFunction,
  offeredCategories?: string[],
  currentCategory?: string
): SelectItemType[] =>
  buildGroupedOptions(
    t('label.internal'),
    t('label.external'),
    offeredCategories,
    currentCategory
  );

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
export const getSelectArgumentConfig = (
  argument: string,
  t: TFunction,
  supportedEventTypes?: EventType[]
) => {
  switch (argument) {
    case 'eventTypeList':
      return {
        // Same narrowing as the classic notification form: only offer event
        // types the selected source can emit.
        items: toSelectItems(
          isEmpty(supportedEventTypes)
            ? getSelectOptionsFromEnum(EventType)
            : getSelectOptionsFromValues(supportedEventTypes ?? [])
        ),
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
