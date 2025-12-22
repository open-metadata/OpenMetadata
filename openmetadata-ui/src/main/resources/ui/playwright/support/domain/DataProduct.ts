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
import { SidebarItem } from '../../constant/sidebar';
import { uuid } from '../../utils/common';
import { selectDataProduct } from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';
import { EntityTypeEndpoint } from '../entity/Entity.interface';
import { EntityClass } from '../entity/EntityClass';
import { Domain } from './Domain';
import { SubDomain } from './SubDomain';

type UserTeamRef = {
  name: string;
  type: string;
};

type ResponseDataType = {
  name: string;
  displayName: string;
  description: string;
  domains: string[];
  id?: string;
  fullyQualifiedName?: string;
  owners?: UserTeamRef[];
  experts?: UserTeamRef[];
};

export class DataProduct extends EntityClass {
  id: string;
  data: ResponseDataType;
  private domains: Domain[];
  createDomain = true;
  private subDomains?: SubDomain[];

  responseData: ResponseDataType = {} as ResponseDataType;

  constructor(domains?: Domain[], name?: string, subDomains?: SubDomain[]) {
    super(EntityTypeEndpoint.DATA_PRODUCT);

    this.id = uuid();
    this.domains = domains ?? [new Domain()];
    this.createDomain = !domains;
    this.subDomains = subDomains;
    const dataName = name ?? `PW%dataProduct.${this.id}`;

    this.data = {
      name: dataName,
      displayName: `PW Data Product ${this.id}`,
      description: 'playwright data product description',
      domains: [],
      // eslint-disable-next-line no-useless-escape
      fullyQualifiedName: `\"${dataName}\"`,
    };
  }

  async create(apiContext: APIRequestContext) {
    if (this.createDomain) {
      await Promise.all(
        this.domains.map((domain) => domain.create(apiContext))
      );
    }

    this.data.domains = this.subDomains?.length
      ? this.subDomains.map(
          (subDomain) => subDomain.data.fullyQualifiedName ?? ''
        ) ?? []
      : this.domains.map((domain) => domain.data.fullyQualifiedName ?? '') ??
        [];

    const response = await apiContext.post('/api/v1/dataProducts', {
      data: this.data,
    });
    const data = await response.json();
    this.responseData = data;

    return data;
  }

  async visitEntityPage(page: Page) {
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, this.data);
  }

  get() {
    return this.data;
  }

  async delete(apiContext: APIRequestContext) {
    const response = await apiContext.delete(
      `/api/v1/dataProducts/name/${encodeURIComponent(
        this.responseData?.fullyQualifiedName ?? this.data.name
      )}`
    );

    return response.body;
  }
}
