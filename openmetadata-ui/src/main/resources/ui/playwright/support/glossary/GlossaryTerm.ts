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
import { getRandomLastName, uuid, visitGlossaryPage } from '../../utils/common';
import { EntityTypeEndpoint } from '../entity/Entity.interface';
import { EntityClass } from '../entity/EntityClass';
import { Glossary } from './Glossary';
import {
  GlossaryTermData,
  GlossaryTermResponseDataType,
} from './Glossary.interface';

export class GlossaryTerm extends EntityClass {
  randomName = getRandomLastName();
  data: GlossaryTermData = {
    name: `PW.${uuid()}%${this.randomName}`,
    displayName: `PW ${uuid()}%${this.randomName}`,
    description: 'A bank account number.',
    mutuallyExclusive: false,
    glossary: '',
    synonyms: '',
    fullyQualifiedName: '',
    reviewers: [],
  };

  responseData: GlossaryTermResponseDataType =
    {} as GlossaryTermResponseDataType;

  constructor(glossary: Glossary, parent?: string, name?: string) {
    super(EntityTypeEndpoint.GlossaryTerm);
    this.data.glossary = glossary.data.name;
    if (parent) {
      this.data.parent = parent;
    }
    // eslint-disable-next-line no-useless-escape
    this.data.fullyQualifiedName = `\"${this.data.glossary}\".\"${this.data.name}\"`;
    this.data.name = name ?? this.data.name;
    this.data.displayName = name ?? this.data.displayName;
    this.data.reviewers = glossary.data.reviewers;
  }

  async visitEntityPage(page: Page) {
    await this.visitPage(page);
  }

  async visitPage(page: Page) {
    await visitGlossaryPage(page, this.responseData.glossary.displayName);
    const expandCollapseButtonText = await page
      .locator('[data-testid="expand-collapse-all-button"]')
      .textContent();
    const isExpanded = expandCollapseButtonText?.includes('Expand All');
    if (isExpanded) {
      const glossaryTermListResponse = page.waitForResponse(
        `/api/v1/glossaryTerms?*glossary=${this.responseData.glossary.id}*`
      );
      await page.click('[data-testid="expand-collapse-all-button"]');
      await glossaryTermListResponse;
    }
    const glossaryTermResponse = page.waitForResponse(
      `/api/v1/glossaryTerms/name/${encodeURIComponent(
        this.responseData.fullyQualifiedName
      )}?*`
    );
    await page.getByTestId(this.data.displayName).click();
    await glossaryTermResponse;

    await expect(page.getByTestId('entity-header-display-name')).toHaveText(
      this.data.displayName
    );
  }

  async create(apiContext: APIRequestContext) {
    const apiData = omit(this.data, [
      'fullyQualifiedName',
      'synonyms',
      'reviewers',
    ]);
    const response = await apiContext.post('/api/v1/glossaryTerms', {
      data: apiData,
    });

    this.responseData = await response.json();

    return await response.json();
  }

  async patch(apiContext: APIRequestContext, data: Record<string, unknown>[]) {
    const response = await apiContext.patch(
      `/api/v1/glossaryTerms/${this.responseData.id}`,
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
    const response = await apiContext.delete(
      `/api/v1/glossaryTerms/name/${encodeURIComponent(
        this.responseData.fullyQualifiedName
      )}?recursive=true&hardDelete=true`
    );

    return await response.json();
  }

  rename(newTermName: string, newTermFqn: string) {
    this.responseData.name = newTermName;
    this.responseData.fullyQualifiedName = newTermFqn;
  }
}
