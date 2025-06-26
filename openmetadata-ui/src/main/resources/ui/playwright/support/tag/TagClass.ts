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
import { APIRequestContext, Page } from '@playwright/test';
import { getRandomLastName } from '../../utils/common';
import { visitClassificationPage } from '../../utils/tag';

type ResponseDataType = {
  style?: {
    color: string;
  };
  description: string;
  displayName: string;
  classification: {
    id: string;
    type: 'classification';
    name: string;
    fullyQualifiedName: string;
    description: string;
    displayName: string;
    deleted: boolean;
    href: string;
  };
  name: string;
  id: string;
  fullyQualifiedName: string;
};

export type TagData = {
  style?: {
    color: string;
  };
  description: string;
  displayName: string;
  classification: string;
  name: string;
};

export class TagClass {
  randomName = getRandomLastName();
  data: TagData = {
    name: `pw-tier-${this.randomName}`,
    displayName: `PW Tier ${this.randomName}`,
    description: 'Tier tag for the Collate platform',
    style: {
      color: '#FFD700',
    },
    classification: 'Tier',
  };

  responseData: ResponseDataType = {} as ResponseDataType;

  constructor(tag: Partial<TagData>) {
    this.data.classification = tag.classification ?? this.data.classification;
  }

  async visitPage(page: Page) {
    await visitClassificationPage(
      page,
      this.responseData.classification.name,
      this.responseData.classification.displayName
    );
    await page.getByTestId(this.data.name).click();
    await page.waitForLoadState('networkidle');
  }

  async create(apiContext: APIRequestContext) {
    const response = await apiContext.post('/api/v1/tags', {
      data: this.data,
    });

    this.responseData = await response.json();

    return await response.json();
  }

  get() {
    return this.responseData;
  }

  async delete(apiContext: APIRequestContext) {
    const response = await apiContext.delete(
      `/api/v1/tags/${this.responseData.id}?recursive=true&hardDelete=true`
    );

    return await response.json();
  }
}
