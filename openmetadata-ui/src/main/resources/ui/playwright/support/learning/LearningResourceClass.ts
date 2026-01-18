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

type LearningResourceContext = {
  pageId: string;
  componentId?: string;
};

type LearningResourceSource = {
  url: string;
  provider?: string;
  embedConfig?: Record<string, unknown>;
};

type LearningResourceData = {
  name: string;
  displayName?: string;
  description?: string;
  resourceType: 'Article' | 'Video' | 'Storylane';
  categories: string[];
  difficulty?: 'Intro' | 'Intermediate' | 'Advanced';
  source: LearningResourceSource;
  contexts: LearningResourceContext[];
  status?: 'Draft' | 'Active' | 'Deprecated';
  estimatedDuration?: number;
};

type ResponseDataType = LearningResourceData & {
  id?: string;
  fullyQualifiedName?: string;
};

export class LearningResourceClass {
  id: string;
  data: LearningResourceData;
  responseData: ResponseDataType = {} as ResponseDataType;

  constructor(data?: Partial<LearningResourceData>) {
    this.id = uuid();
    this.data = {
      name: `PW_LearningResource_${this.id}`,
      displayName: `PW Learning Resource ${this.id}`,
      description: 'Playwright test learning resource description',
      resourceType: 'Video',
      categories: ['Discovery'],
      difficulty: 'Intro',
      source: {
        url: 'https://www.youtube.com/watch?v=test123',
        provider: 'YouTube',
      },
      contexts: [{ pageId: 'glossary' }],
      status: 'Active',
      ...data,
    };
  }

  get() {
    return this.responseData;
  }

  async create(apiContext: APIRequestContext) {
    const response = await apiContext.post('/api/v1/learning/resources', {
      data: this.data,
    });
    const data = await response.json();
    this.responseData = data;

    return data;
  }

  async patch(
    apiContext: APIRequestContext,
    patchData: Partial<LearningResourceData>
  ) {
    const response = await apiContext.patch(
      `/api/v1/learning/resources/${this.responseData.id}`,
      {
        data: [
          ...Object.entries(patchData).map(([key, value]) => ({
            op: 'replace',
            path: `/${key}`,
            value,
          })),
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );
    const data = await response.json();
    this.responseData = data;

    return data;
  }

  async delete(apiContext: APIRequestContext) {
    const response = await apiContext.delete(
      `/api/v1/learning/resources/${this.responseData.id}?hardDelete=true`
    );

    return await response.json();
  }
}
