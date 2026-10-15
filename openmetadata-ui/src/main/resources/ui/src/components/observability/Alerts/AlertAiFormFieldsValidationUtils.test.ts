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
import { AlertType } from '../../../generated/events/eventSubscription';
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

  describe('name follows the classic NAME_FIELD_RULES', () => {
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
});
