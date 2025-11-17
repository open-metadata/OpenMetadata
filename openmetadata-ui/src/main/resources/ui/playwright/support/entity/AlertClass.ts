/*
 *  Copyright 2025 Collate.
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
import { APIRequestContext } from '@playwright/test';
import { uuid } from '../../utils/common';

interface AlertConfig {
  name?: string;
  displayName?: string;
  description?: string;
  alertType: 'Notification' | 'Observability';
  resources?: string[];
  destinations?: Array<{
    type: string;
    config: unknown;
    category?: string;
  }>;
  triggerConfig?: {
    type: string;
  };
}

export class AlertClass {
  private alertData: {
    name: string;
    displayName: string;
    description: string;
    alertType: string;
    resources: string[];
    input: Record<string, unknown>;
    destinations: Array<{
      type: string;
      config: unknown;
      category?: string;
    }>;
    provider: string;
  };

  public responseData: {
    id: string;
    name: string;
    fullyQualifiedName: string;
    displayName: string;
  } = {} as {
    id: string;
    name: string;
    fullyQualifiedName: string;
    displayName: string;
  };

  constructor(config: AlertConfig) {
    const alertName = config.name ?? `pw-alert-${uuid()}`;
    const displayName = config.displayName ?? `PW Alert ${uuid()}`;

    this.alertData = {
      name: alertName,
      displayName,
      description: config.description ?? `Description for ${displayName}`,
      alertType: config.alertType,
      resources: config.resources ?? ['all'],
      input: {},
      destinations: config.destinations ?? [
        {
          type: 'Email',
          config: {
            sendToAdmins: true,
          },
          category: 'Admins',
        },
      ],
      provider: 'user',
    };
  }

  async create(apiContext: APIRequestContext) {
    const response = await apiContext.post('/api/v1/events/subscriptions', {
      data: this.alertData,
    });

    this.responseData = await response.json();

    return this.responseData;
  }

  async delete(apiContext: APIRequestContext) {
    const response = await apiContext.delete(
      `/api/v1/events/subscriptions/${this.responseData.id}?hardDelete=true&recursive=false`
    );

    return response;
  }

  get() {
    return this.responseData;
  }
}
