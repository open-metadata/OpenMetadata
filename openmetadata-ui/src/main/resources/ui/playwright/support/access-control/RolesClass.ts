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

type ResponseDataType = {
  name: string;
  displayName: string;
  description: string;
  id?: string;
  fullyQualifiedName?: string;
};

export class RolesClass {
  id = uuid();
  data: ResponseDataType;
  responseData: ResponseDataType = {} as ResponseDataType;

  constructor(data?: ResponseDataType) {
    this.data = data ?? {
      name: `PW%Roles-${this.id}`,
      displayName: `PW Roles ${this.id}`,
      description: 'playwright for roles description',
    };
  }

  get() {
    return this.responseData;
  }

  async create(apiContext: APIRequestContext, policies: string[]) {
    const response = await apiContext.post('/api/v1/roles', {
      data: { ...this.data, policies },
    });
    const data = await response.json();
    this.responseData = data;

    return data;
  }

  async delete(apiContext: APIRequestContext) {
    const response = await apiContext.delete(
      `/api/v1/roles/${this.responseData.id}?hardDelete=true&recursive=true`
    );

    return await response.json();
  }
}
