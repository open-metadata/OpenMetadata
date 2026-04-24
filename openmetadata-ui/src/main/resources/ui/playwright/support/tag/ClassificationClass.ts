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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import { getRandomLastName } from '../../utils/common';
import { visitClassificationPage } from '../../utils/tag';
type ClassificationData = {
  name: string;
  displayName: string;
  description: string;
  id?: string;
  fullyQualifiedName?: string;
  provider?: string;
  mutuallyExclusive?: boolean;
};

export class ClassificationClass {
  randomName: string;
  data: ClassificationData;

  responseData: ClassificationData = {} as ClassificationData;

  constructor(classification?: Partial<ClassificationData>) {
    this.randomName = getRandomLastName();
    this.data = {
      name: `pw-classification-${this.randomName}`,
      displayName: `PW Classification ${this.randomName}`,
      description: 'Classification for the Collate platform',
      ...classification,
    };
  }

  async visitPage(page: Page) {
    await visitClassificationPage(
      page,
      this.responseData.name ?? this.data.name,
      this.responseData.displayName ?? this.data.displayName
    );

    await expect(page.locator('.activeCategory')).toContainText(
      this.responseData.displayName ?? this.data.displayName
    );
  }

  async create(apiContext: APIRequestContext) {
    const response = await apiContext.post('/api/v1/classifications', {
      data: this.data,
    });

    this.responseData = await response.json();

    return this.responseData;
  }
  async patch(apiContext: APIRequestContext, payload: Operation[]) {
    const response = await apiContext.patch(
      `/api/v1/classifications/${this.responseData.id}`,
      {
        data: payload,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    this.responseData = await response.json();

    return this.responseData;
  }

  get() {
    return this.responseData;
  }

  async delete(apiContext: APIRequestContext) {
    const response = await apiContext.delete(
      `/api/v1/classifications/${this.responseData.id}?recursive=true&hardDelete=true`
    );

    return await response.json();
  }
}
