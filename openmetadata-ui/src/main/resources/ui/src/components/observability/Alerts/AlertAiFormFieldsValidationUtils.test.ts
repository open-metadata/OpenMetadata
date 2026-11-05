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
import { AlertType, Effect } from '../../../generated/events/eventSubscription';
import { ModifiedCreateEventSubscription } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { getValidationPath } from './AlertAiFormFieldsPureUtils';
import { validateAlertAiForm } from './AlertAiFormFieldsValidationUtils';

const t = ((key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${Object.values(params).join(':')}` : key) as TFunction;

describe('AlertAiFormFieldsValidationUtils', () => {
  it('requires at least one destination', () => {
    expect(
      validateAlertAiForm(
        {
          destinations: [],
          input: {},
          name: 'test-alert',
          alertType: AlertType.Observability,
          readTimeout: 12,
          resources: ['table'],
          timeout: 10,
        } as ModifiedCreateEventSubscription,
        t
      )
    ).toEqual({
      destinations: 'message.field-text-is-required:label.destination',
    });
  });

  describe('name follows NAME_FIELD_REGISTER_RULES', () => {
    const validate = (displayName: string) =>
      validateAlertAiForm(
        {
          destinations: [{ category: 'Owners', type: 'Email' }],
          displayName,
          input: {},
          name: '',
          alertType: AlertType.Notification,
          readTimeout: 12,
          resources: ['table'],
          timeout: 10,
        } as unknown as ModifiedCreateEventSubscription,
        t
      );

    it('rejects names longer than 128 characters', () => {
      expect(validate('a'.repeat(129)).displayName).toBe(
        'message.entity-size-in-between:label.name:1:128'
      );
    });

    it('rejects names the entity-name pattern forbids', () => {
      expect(validate('orders::alert').displayName).toBe(
        'message.entity-name-validation'
      );
    });

    it('accepts a valid name', () => {
      expect(validate('Orders table – failures').displayName).toBeUndefined();
    });
  });

  it('requires a key and value for every webhook header and query param', () => {
    const errors = validateAlertAiForm(
      {
        destinations: [
          {
            category: 'External',
            destinationType: 'Webhook',
            type: 'Webhook',
            config: {
              endpoint: 'https://hooks.example.com',
              headers: [{ key: 'X-Token', value: '' }],
              queryParams: [{ key: '', value: 'v' }],
            },
          },
        ],
        displayName: 'alert',
        input: {},
        name: 'alert',
        alertType: AlertType.Observability,
        readTimeout: 12,
        resources: ['table'],
        timeout: 10,
      } as unknown as ModifiedCreateEventSubscription,
      t
    );

    expect(errors).toEqual({
      [getValidationPath('destinations', 0, 'config', 'headers', 0, 'value')]:
        'message.field-text-is-required:label.value',
      [getValidationPath('destinations', 0, 'config', 'queryParams', 0, 'key')]:
        'message.field-text-is-required:label.key',
    });
  });

  describe('legacy alerts seeded from filteringRules', () => {
    // A legacy WrittenByHand alert: rules live only in filteringRules with no `input`.
    // getModifiedAlertDataForForm seeds `input` from filteringRules for display, but the
    // seeded arguments carry names without values (undefined `input`) — their values live
    // in the SpEL condition the form cannot represent. The form must not block saving
    // just because those legacy arguments have no `input` value.
    const legacyFormData: ModifiedCreateEventSubscription = {
      destinations: [
        { category: 'Owners', destinationType: 'Email', type: 'Email' },
      ],
      displayName: 'legacy-alert',
      name: 'legacy-alert',
      alertType: AlertType.Observability,
      readTimeout: 12,
      resources: ['table'],
      timeout: 10,
      input: {
        actions: [
          {
            arguments: [{ name: 'testSuiteList' }],
            effect: Effect.Include,
            name: 'testResultTrigger',
          },
        ],
        filters: [
          {
            arguments: [{ name: 'domainList' }],
            effect: Effect.Include,
            name: 'domainList',
          },
        ],
      },
    } as unknown as ModifiedCreateEventSubscription;

    it('does not require input values for legacy arguments (undefined input)', () => {
      const errors = validateAlertAiForm(legacyFormData, t);

      // No validation errors for the seeded legacy rules' arguments — a user can
      // change the name or destination and save without reconstructing the SpEL
      // condition values. The legacy arguments have `input: undefined`, which the
      // validator skips; only user-added arguments (`input: []`) must be filled.
      expect(
        errors[
          getValidationPath('input', 'filters', 0, 'arguments', 0, 'input')
        ]
      ).toBeUndefined();
      expect(
        errors[
          getValidationPath('input', 'actions', 0, 'arguments', 0, 'input')
        ]
      ).toBeUndefined();
    });

    it('still requires input values for user-added arguments (empty array input)', () => {
      const formData: ModifiedCreateEventSubscription = {
        ...legacyFormData,
        input: {
          actions: [],
          filters: [
            {
              arguments: [{ input: [], name: 'domainList' }],
              effect: Effect.Include,
              name: 'domainList',
            },
          ],
        },
      } as unknown as ModifiedCreateEventSubscription;

      const errors = validateAlertAiForm(formData, t);

      // A user-added rule with an empty `input` array (not undefined) must still
      // require the user to fill in the value before saving.
      expect(
        errors[
          getValidationPath('input', 'filters', 0, 'arguments', 0, 'input')
        ]
      ).toBeDefined();
    });
  });
});
