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
  AlertType,
  ArgumentsInput,
  Effect,
  EventFilterRule,
  InputType,
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import { EventType } from '../../../generated/type/changeEvent';
import { ModifiedDestination } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { ALERT_AI_DEFAULT_DOWNSTREAM_DEPTH } from './AlertAiFormFields.constants';
import { AlertAiFormValue } from './AlertAiFormFields.interface';
import {
  getAlertAiSectionVisibility,
  getDestinationTypeUpdate,
  getDestinationWithNotifyDownstream,
  getRuleEventTypes,
  getRuleItems,
  getRulesWithAddedRule,
  getRulesWithEffect,
  getRulesWithName,
  getRulesWithoutIndex,
  getRuntimeArguments,
  hasExternalDestinationConfig,
  setValueAtPath,
  updateAlertAiValue,
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

  describe('getRuleEventTypes (per-flow classic parity)', () => {
    const resource = {
      name: 'table',
      supportedEventTypes: [EventType.EntityCreated],
    };

    it('narrows event types for notification alerts, like Settings → Notifications', () => {
      expect(getRuleEventTypes(AlertType.Notification, resource)).toEqual([
        EventType.EntityCreated,
      ]);
    });

    it('never narrows observability alerts, like Observability → Alerts', () => {
      expect(
        getRuleEventTypes(AlertType.Observability, resource)
      ).toBeUndefined();
    });
  });
});

describe('setValueAtPath', () => {
  const asValue = (obj: unknown) => obj as AlertAiFormValue;
  const asRecord = (value: AlertAiFormValue) =>
    value as unknown as Record<string, unknown>;

  it('sets a nested path and returns a new root', () => {
    const source = asValue({ input: {}, destinations: [] });
    const result = setValueAtPath(source, ['input', 'foo'], 'bar');

    expect(result).not.toBe(source);
    expect(asRecord(result).input).toEqual({ foo: 'bar' });
  });

  it('preserves off-path sibling references (structural sharing)', () => {
    const source = asValue({
      input: { a: 1 },
      destinations: [{ id: 'a' }, { id: 'b' }],
    });
    const result = setValueAtPath(source, ['destinations', 0, 'id'], 'z');
    const record = asRecord(result);
    const destinations = record.destinations as Array<{ id: string }>;
    const sourceDestinations = asRecord(source).destinations as Array<{
      id: string;
    }>;

    // Changed node is a fresh copy...
    expect(destinations[0]).not.toBe(sourceDestinations[0]);
    expect(destinations[0].id).toBe('z');
    // ...but the untouched sibling and off-path branch keep their reference, so React skips them.
    expect(destinations[1]).toBe(sourceDestinations[1]);
    expect(record.input).toBe(asRecord(source).input);
  });

  it('creates a missing container as array or object based on the next segment', () => {
    expect(asRecord(setValueAtPath(asValue({}), ['a', 0], 'x')).a).toEqual([
      'x',
    ]);
    expect(asRecord(setValueAtPath(asValue({}), ['a', 'b'], 'x')).a).toEqual({
      b: 'x',
    });
  });

  it('returns nextValue for an empty path', () => {
    expect(setValueAtPath(asValue({ a: 1 }), [], 'replaced')).toBe('replaced');
  });
});

describe('updateAlertAiValue', () => {
  it('dispatches a functional updater, not a value', () => {
    const onChange = jest.fn();

    updateAlertAiValue({} as AlertAiFormValue, onChange, ['input', 'x'], 1);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(typeof onChange.mock.calls[0][0]).toBe('function');
  });

  it('composes rapid successive writes so neither clobbers the other', () => {
    const onChange = jest.fn();
    const prev = { input: {}, destinations: [{ config: { headers: [{}] } }] };

    // Two quick writes both captured before any re-render — the empty-header-key 400 scenario.
    updateAlertAiValue(
      prev as unknown as AlertAiFormValue,
      onChange,
      ['destinations', 0, 'config', 'headers', 0, 'key'],
      'k'
    );
    updateAlertAiValue(
      prev as unknown as AlertAiFormValue,
      onChange,
      ['destinations', 0, 'config', 'headers', 0, 'value'],
      'v'
    );

    const applied = onChange.mock.calls.reduce(
      (state, [updater]) => updater(state),
      prev as unknown
    );

    expect(applied).toEqual({
      input: {},
      destinations: [{ config: { headers: [{ key: 'k', value: 'v' }] } }],
    });
  });
});
