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
  ArgumentsInput,
  Effect,
  EventFilterRule,
  InputType,
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import { ModifiedDestination } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { ALERT_AI_DEFAULT_DOWNSTREAM_DEPTH } from './AlertAiFormFields.constants';
import {
  getAlertAiSectionVisibility,
  getDestinationTypeUpdate,
  getDestinationWithNotifyDownstream,
  getRuleItems,
  getRulesWithAddedRule,
  getRulesWithEffect,
  getRulesWithName,
  getRulesWithoutIndex,
  getRuntimeArguments,
  hasExternalDestinationConfig,
} from './AlertAiFormFieldsPureUtils';

describe('AlertAiFormFieldsPureUtils', () => {
  it('hides empty configurable sections in read-only mode', () => {
    const visibility = getAlertAiSectionVisibility({
      isViewOnly: true,
      selectedFilters: [],
      selectedSource: undefined,
      selectedTriggers: [],
      shouldShowActionsSection: true,
      shouldShowFiltersSection: true,
    });

    expect(visibility).toEqual({
      shouldRenderActionsSection: false,
      shouldRenderFiltersSection: false,
      shouldRenderSourceSection: false,
    });
  });

  it('keeps empty configurable sections visible in edit mode', () => {
    const visibility = getAlertAiSectionVisibility({
      isViewOnly: false,
      selectedFilters: [],
      selectedSource: undefined,
      selectedTriggers: [],
      shouldShowActionsSection: true,
      shouldShowFiltersSection: true,
    });

    expect(visibility).toEqual({
      shouldRenderActionsSection: true,
      shouldRenderFiltersSection: true,
      shouldRenderSourceSection: true,
    });
  });

  it('creates rule items and disables already selected rules', () => {
    const supportedRules: EventFilterRule[] = [
      {
        condition: '',
        displayName: 'Domain',
        effect: Effect.Include,
        name: 'domainList',
      },
      {
        condition: '',
        displayName: 'Pipeline State',
        effect: Effect.Include,
        name: 'pipelineStateList',
      },
    ];
    const selectedRules: ArgumentsInput[] = [{ name: 'domainList' }];

    expect(getRuleItems(supportedRules, selectedRules)).toEqual([
      { id: 'domainList', isDisabled: true, label: 'Domain' },
      {
        id: 'pipelineStateList',
        isDisabled: false,
        label: 'Pipeline State',
      },
    ]);
  });

  it('uses descriptor arguments for runtime rules', () => {
    const selectedRule: ArgumentsInput = { name: 'domainList' };
    const supportedRules: EventFilterRule[] = [
      {
        arguments: ['domainList', 'fqnList'],
        condition: '',
        effect: Effect.Include,
        inputType: InputType.Runtime,
        name: 'domainList',
      },
    ];

    expect(getRuntimeArguments(selectedRule, supportedRules)).toEqual([
      'domainList',
      'fqnList',
    ]);
  });

  it('falls back to selected rule argument names when rule is not runtime', () => {
    const selectedRule: ArgumentsInput = {
      arguments: [
        { input: ['Created'], name: 'eventTypeList' },
        { input: ['Updated'], name: 'updateTypeList' },
      ],
      name: 'eventTypeList',
    };

    expect(getRuntimeArguments(selectedRule, [])).toEqual([
      'eventTypeList',
      'updateTypeList',
    ]);
  });

  it('updates rule name, effect, add, and remove payloads immutably', () => {
    const selectedRules: ArgumentsInput[] = [
      { effect: Effect.Include, name: 'domainList' },
      { effect: Effect.Exclude, name: 'ownerNameList' },
    ];
    const supportedRules: EventFilterRule[] = [
      {
        arguments: ['pipelineStateList'],
        condition: '',
        effect: Effect.Include,
        name: 'pipelineStateList',
      },
    ];

    expect(
      getRulesWithName({
        index: 0,
        ruleName: 'pipelineStateList',
        selectedRules,
        supportedRules,
      })
    ).toEqual([
      {
        arguments: [{ input: [], name: 'pipelineStateList' }],
        effect: Effect.Include,
        name: 'pipelineStateList',
      },
      { effect: Effect.Exclude, name: 'ownerNameList' },
    ]);
    expect(getRulesWithEffect(selectedRules, 1, true)[1]).toEqual({
      effect: Effect.Include,
      name: 'ownerNameList',
    });
    expect(getRulesWithAddedRule(selectedRules)).toEqual([
      ...selectedRules,
      { effect: Effect.Include },
    ]);
    expect(getRulesWithoutIndex(selectedRules, 0)).toEqual([
      { effect: Effect.Exclude, name: 'ownerNameList' },
    ]);
    expect(selectedRules[0]).toEqual({
      effect: Effect.Include,
      name: 'domainList',
    });
  });

  it('maps internal and external destination type updates', () => {
    expect(
      getDestinationTypeUpdate(
        {} as ModifiedDestination,
        SubscriptionCategory.Owners
      )
    ).toEqual({
      category: SubscriptionCategory.Owners,
      destinationType: SubscriptionCategory.Owners,
    });

    expect(
      getDestinationTypeUpdate(
        {} as ModifiedDestination,
        SubscriptionType.Slack
      )
    ).toEqual({
      category: SubscriptionCategory.External,
      destinationType: SubscriptionType.Slack,
      type: SubscriptionType.Slack,
    });
  });

  it('defaults and clears downstream depth when notify downstream changes', () => {
    expect(
      getDestinationWithNotifyDownstream({} as ModifiedDestination, true)
    ).toEqual({
      downstreamDepth: ALERT_AI_DEFAULT_DOWNSTREAM_DEPTH,
      notifyDownstream: true,
    });

    expect(
      getDestinationWithNotifyDownstream(
        {
          downstreamDepth: 4,
          notifyDownstream: true,
        } as ModifiedDestination,
        false
      )
    ).toEqual({
      downstreamDepth: undefined,
      notifyDownstream: false,
    });
  });

  it('detects selected external destinations for test action enablement', () => {
    expect(
      hasExternalDestinationConfig([
        {
          category: SubscriptionCategory.External,
          config: {},
          type: SubscriptionType.Slack,
        } as ModifiedDestination,
      ])
    ).toBe(true);

    expect(
      hasExternalDestinationConfig([
        {
          category: SubscriptionCategory.External,
          config: { endpoint: 'https://example.com' },
        } as ModifiedDestination,
        {
          category: SubscriptionCategory.Owners,
          config: { endpoint: 'https://example.com' },
        } as ModifiedDestination,
      ])
    ).toBe(false);
  });
});
