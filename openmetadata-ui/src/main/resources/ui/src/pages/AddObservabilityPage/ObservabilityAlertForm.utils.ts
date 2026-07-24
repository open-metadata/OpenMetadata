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
  Effect,
  EventFilterRule,
  InputType,
  PrefixCondition,
} from '../../generated/events/eventSubscription';
import {
  Effect as ResourceEffect,
  EventFilterRule as ResourceEventFilterRule,
  FilterResourceDescriptor,
  InputType as ResourceInputType,
  PrefixCondition as ResourcePrefixCondition,
} from '../../generated/events/filterResourceDescriptor';
import { ObservabilityFilterResourceDescriptor } from './AddObservabilityPage.interface';

type ObservabilityFilterResourceApiDescriptor = FilterResourceDescriptor &
  Pick<ObservabilityFilterResourceDescriptor, 'containerEntities'>;

const getEventFilterRuleEffect = (
  effect: ResourceEventFilterRule['effect']
): EventFilterRule['effect'] => {
  switch (effect) {
    case ResourceEffect.Include:
      return Effect.Include;
    case ResourceEffect.Exclude:
    default:
      return Effect.Exclude;
  }
};

const getEventFilterRuleInputType = (
  inputType?: ResourceEventFilterRule['inputType']
): EventFilterRule['inputType'] | undefined => {
  switch (inputType) {
    case ResourceInputType.None:
      return InputType.None;
    case ResourceInputType.Runtime:
      return InputType.Runtime;
    case ResourceInputType.Static:
      return InputType.Static;
    default:
      return undefined;
  }
};

const getEventFilterRulePrefixCondition = (
  prefixCondition?: ResourceEventFilterRule['prefixCondition']
): EventFilterRule['prefixCondition'] | undefined => {
  switch (prefixCondition) {
    case ResourcePrefixCondition.And:
      return PrefixCondition.And;
    case ResourcePrefixCondition.Or:
      return PrefixCondition.Or;
    default:
      return undefined;
  }
};

const toEventFilterRule = (rule: ResourceEventFilterRule): EventFilterRule => {
  const inputType = getEventFilterRuleInputType(rule.inputType);
  const prefixCondition = getEventFilterRulePrefixCondition(
    rule.prefixCondition
  );

  return {
    condition: rule.condition,
    effect: getEventFilterRuleEffect(rule.effect),
    ...(rule.arguments ? { arguments: rule.arguments } : {}),
    ...(rule.description ? { description: rule.description } : {}),
    ...(rule.displayName ? { displayName: rule.displayName } : {}),
    ...(rule.fullyQualifiedName
      ? { fullyQualifiedName: rule.fullyQualifiedName }
      : {}),
    ...(inputType ? { inputType } : {}),
    ...(rule.name ? { name: rule.name } : {}),
    ...(prefixCondition ? { prefixCondition } : {}),
  };
};

const toEventFilterRules = (rules?: ResourceEventFilterRule[]) =>
  rules?.map(toEventFilterRule);

export const toObservabilityFilterResourceDescriptor = (
  resource: FilterResourceDescriptor
): ObservabilityFilterResourceDescriptor => {
  const observabilityResource: ObservabilityFilterResourceApiDescriptor =
    resource;

  return {
    containerEntities: observabilityResource.containerEntities,
    name: resource.name,
    supportedActions: toEventFilterRules(resource.supportedActions),
    supportedFilters: toEventFilterRules(resource.supportedFilters),
  };
};
