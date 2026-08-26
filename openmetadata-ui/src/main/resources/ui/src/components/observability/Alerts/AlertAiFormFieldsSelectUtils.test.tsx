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
  CUSTOM_TEMPLATE_VALUE,
  SYSTEM_DEFAULT_TEMPLATES,
} from './Template.constants';
import { TFunction } from 'i18next';
import { Type } from '../../../generated/events/eventSubscription';
import {
  getAuthTypeItems,
  getTemplateItems,
} from './AlertAiFormFieldsSelectUtils';

jest.mock('./NotificationTemplateUtils', () => ({
  getTemplateEntityRefObject: jest.fn((template) => ({
    id: template.id,
    name: template.name,
    type: 'notificationTemplate',
  })),
}));

const t = ((key: string, params?: Record<string, string>) =>
  params ? `${key}:${Object.values(params).join(':')}` : key) as TFunction;

describe('AlertAiFormFieldsSelectUtils', () => {
  it('builds auth type select items', () => {
    expect(getAuthTypeItems(t)).toEqual([
      { id: Type.None, label: 'label.no-authentication' },
      { id: Type.Bearer, label: 'label.bearer-hmac-signature' },
      {
        id: Type.Oauth2,
        label: 'label.oauth2-client-credential-plural',
      },
    ]);
  });

  it('includes selected unloaded notification template in options', () => {
    const selectedTemplate = JSON.stringify({
      displayName: 'Custom Alert Template',
      name: 'custom_alert_template',
    });

    expect(getTemplateItems([], selectedTemplate, t)).toEqual([
      {
        id: selectedTemplate,
        label: 'Custom Alert Template',
      },
      {
        id: SYSTEM_DEFAULT_TEMPLATES,
        label: 'label.system-default-template',
      },
      {
        id: CUSTOM_TEMPLATE_VALUE,
        label: 'label.create-entity:label.custom-template',
      },
    ]);
  });
});
