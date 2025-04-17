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
import { omit } from 'lodash';
import {
  getRandomFirstName,
  uuid,
  visitGlossaryPage,
} from '../../utils/common';
import {
  EntityReference,
  EntityTypeEndpoint,
} from '../entity/Entity.interface';
import { EntityClass } from '../entity/EntityClass';
import { GlossaryData, GlossaryResponseDataType } from './Glossary.interface';

export class Glossary extends EntityClass {
  randomName = getRandomFirstName();
  randomId = uuid();
  data: GlossaryData = {
    name: `PW%${this.randomId}.${this.randomName}`,
    displayName: `PW % ${this.randomId} ${this.randomName}`,
    description:
      'Glossary terms that describe general conceptual terms. Note that these conceptual terms are used for automatically labeling the data.',
    reviewers: [],
    tags: [],
    mutuallyExclusive: false,
    terms: [],
    owners: [],
    // eslint-disable-next-line no-useless-escape
    fullyQualifiedName: `\"PW%${this.randomId}.${this.randomName}\"`,
  };

  responseData: GlossaryResponseDataType = {} as GlossaryResponseDataType;

  constructor(name?: string, reviewers?: EntityReference[]) {
    super(EntityTypeEndpoint.Glossary);
    this.data.name = name ?? this.data.name;
    this.data.reviewers = reviewers ?? this.data.reviewers;
  }

  async visitEntityPage(page: Page) {
    await this.visitPage(page);
  }

  async visitPage(page: Page) {
    await visitGlossaryPage(page, this.data.displayName);

    await expect(page.getByTestId('entity-header-display-name')).toHaveText(
      this.data.displayName
    );
  }

  async create(apiContext: APIRequestContext) {
    const apiData = omit(this.data, ['fullyQualifiedName', 'terms', 'owners']);
    const response = await apiContext.post('/api/v1/glossaries', {
      data: apiData,
    });

    this.responseData = await response.json();

    return this.responseData;
  }

  async patch(apiContext: APIRequestContext, data: Record<string, unknown>[]) {
    const response = await apiContext.patch(
      `/api/v1/glossaries/${this.responseData.id}`,
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

  get() {
    return this.responseData;
  }

  async delete(apiContext: APIRequestContext) {
    const fqn =
      this?.responseData?.fullyQualifiedName ?? this.data.fullyQualifiedName;

    const response = await apiContext.delete(
      `/api/v1/glossaries/name/${encodeURIComponent(
        fqn
      )}?recursive=true&hardDelete=true`
    );

    return await response.json();
  }
}
