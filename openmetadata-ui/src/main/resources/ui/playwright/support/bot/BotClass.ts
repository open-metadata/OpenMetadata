/*
 *  Copyright 2024 Collate.
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

export type BotResponseDataType = {
  name: string;
  botUser: string;
  description: string;
  id?: string;
  fullyQualifiedName?: string;
};

export type UserResponseDataType = {
  botUser: undefined;
  name: string;
  description: string;
  id?: string;
  fullyQualifiedName?: string;
  email: string;
  isAdmin: boolean;
  isBot: boolean;
  authenticationMechanism: {
    authType: string;
    config: {
      JWTTokenExpiry: string;
    };
  };
};

export class BotClass {
  id = uuid();
  data: BotResponseDataType;
  userData: UserResponseDataType;
  responseData: BotResponseDataType = {} as BotResponseDataType;

  constructor(data?: BotResponseDataType) {
    this.data = data ?? {
      botUser: `PW%Bot-${this.id}`,
      name: `PW%Bot-${this.id}`,
      description: 'playwright for bot description',
    };
    this.userData = {
      ...this.data,
      botUser: undefined,
      email: `pw_bot${this.id}@gmail.com`,
      isAdmin: false,
      isBot: true,
      authenticationMechanism: {
        authType: 'JWT',
        config: {
          JWTTokenExpiry: 'OneHour',
        },
      },
    };
  }

  get() {
    return this.responseData;
  }

  async create(apiContext: APIRequestContext) {
    const userResponse = await apiContext.put('/api/v1/users', {
      data: this.userData,
    });

    const response = await apiContext.post('/api/v1/bots', {
      data: this.data,
    });
    const data = await response.json();
    this.responseData = data;

    const userResponseData = await userResponse.json();
    this.userData = userResponseData;

    return data;
  }

  async delete(apiContext: APIRequestContext) {
    const response = await apiContext.delete(
      `/api/v1/bots/${this.responseData.id}?hardDelete=true&recursive=false`
    );

    return await response.json();
  }

  async patch(apiContext: APIRequestContext, data: Record<string, unknown>[]) {
    const response = await apiContext.patch(
      `/api/v1/bots/${this.responseData.id}`,
      {
        data,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    this.responseData = await response.json();

    return await response.json();
  }
}
