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
import { Operation } from 'fast-json-patch';
import { SidebarItem } from '../../constant/sidebar';
import { uuid } from '../../utils/common';
import { selectDomain } from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';
import { EntityTypeEndpoint } from '../entity/Entity.interface';
import { EntityClass } from '../entity/EntityClass';

type UserTeamRef = {
  name: string;
  type: string;
  fullyQualifiedName?: string;
  id?: string;
};

type ResponseDataType = {
  name: string;
  displayName: string;
  description: string;
  domainType: string;
  id?: string;
  fullyQualifiedName?: string;
  owners?: UserTeamRef[];
  experts?: string[];
};

export class Domain extends EntityClass {
  id: string;
  data: ResponseDataType;

  responseData: ResponseDataType = {} as ResponseDataType;

  constructor(data?: ResponseDataType) {
    super(EntityTypeEndpoint.Domain);
    this.id = uuid();
    this.data = data ?? {
      name: `PW%domain.${this.id}`,
      displayName: `PW Domain ${this.id}`,
      description: 'playwright domain description',
      domainType: 'Aggregate',
      // eslint-disable-next-line no-useless-escape
      fullyQualifiedName: `\"PW%domain.${this.id}\"`,
    };
  }

  async visitEntityPage(page: Page) {
    await sidebarClick(page, SidebarItem.DOMAIN);
    await page.waitForLoadState('networkidle');
    await selectDomain(page, this.responseData);
  }

  async create(apiContext: APIRequestContext) {
    const response = await apiContext.post('/api/v1/domains', {
      data: this.data,
    });
    const data = await response.json();
    this.responseData = data;

    return data;
  }

  get() {
    return this.data;
  }

  async delete(apiContext: APIRequestContext) {
    const response = await apiContext.delete(
      `/api/v1/domains/name/${encodeURIComponent(
        this.responseData?.fullyQualifiedName ?? this.data.name
      )}?recursive=true&hardDelete=true`
    );

    return response.body;
  }

  async patch({
    apiContext,
    patchData,
  }: {
    apiContext: APIRequestContext;
    patchData: Operation[];
  }) {
    const response = await apiContext.patch(
      `/api/v1/domains/${this.responseData?.id}`,
      {
        data: patchData,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    this.responseData = await response.json();

    return {
      entity: this.responseData,
    };
  }
}
