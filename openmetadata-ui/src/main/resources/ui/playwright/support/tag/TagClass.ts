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
import { okJson } from '../../utils/apiResponse';
import { getRandomLastName } from '../../utils/common';
import { getEncodedFqn } from '../../utils/entity';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';

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
    const fqn = this.responseData.fullyQualifiedName;
    const tagResponse = waitForResponseWithStatus(
      page,
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname ===
          `/api/v1/tags/name/${getEncodedFqn(fqn)}`,
      200
    );

    await page.goto(`/tag/${getEncodedFqn(fqn)}`, {
      waitUntil: 'domcontentloaded',
    });
    expect((await (await tagResponse).json()).id).toBe(this.responseData.id);
    await expect(
      page
        .getByTestId('data-classification')
        .or(page.getByTestId('tag-detail-header'))
    ).toBeVisible();
  }

  async create(apiContext: APIRequestContext) {
    const response = await apiContext.post('/api/v1/tags', {
      data: this.data,
    });

    this.responseData = await okJson(response, 'TagClass.create');

    return await okJson(response, 'TagClass.create');
  }

  get() {
    return this.responseData;
  }

  async delete(apiContext: APIRequestContext) {
    const response = await deleteFixtureEntity(
      apiContext,
      `/api/v1/tags/${this.responseData.id}?recursive=true&hardDelete=true`
    );

    return await response.json();
  }

  getTagDisplayName() {
    return this.responseData.displayName;
  }
}

import { deleteFixtureEntity } from '../../utils/apiResponse';
