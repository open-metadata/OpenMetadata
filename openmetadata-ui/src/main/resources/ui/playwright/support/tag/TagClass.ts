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
  autoClassificationEnabled?: boolean;
  autoClassificationPriority?: number;
};

export class TagClass {
  randomName: string;
  data: TagData;

  responseData: ResponseDataType = {} as ResponseDataType;

  constructor(tag: Partial<TagData>) {
    this.randomName = getRandomLastName();
    this.data = {
      name: tag?.name ?? `pw-tier-${this.randomName}`,
      displayName: `PW Tier ${this.randomName}`,
      description: 'Tier tag for the Collate platform',
      style: {
        color: '#FFD700',
      },
      classification: tag.classification ?? 'Tier',
    };
    if (typeof tag.autoClassificationEnabled === 'boolean') {
      this.data.autoClassificationEnabled = tag.autoClassificationEnabled;
    }

    if (typeof tag.autoClassificationPriority === 'number') {
      this.data.autoClassificationPriority = tag.autoClassificationPriority;
    }
  }

  async visitPage(page: Page) {
    const openClassificationPage = async () => {
      await visitClassificationPage(
        page,
        this.responseData.classification.name,
        this.responseData.classification.displayName
      );
    };

    await openClassificationPage();

    await expect
      .poll(
        async () => {
          const tagRow = page.getByTestId(this.data.name);
          const visible = await tagRow.isVisible().catch(() => false);

          if (visible) {
            return true;
          }

          await openClassificationPage();

          return false;
        },
        {
          timeout: 120000,
          intervals: [1000, 2000, 5000],
          message: `Timed out waiting for tag ${this.data.name} to become visible`,
        }
      )
      .toBe(true);

    const tagLink = page.getByTestId(this.data.name);
    const href = await tagLink.getAttribute('href');
    if (href) {
      await page.goto(href);
    } else {
      await tagLink.click();
    }
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

  getTagDisplayName() {
    return this.responseData.displayName;
  }
}
