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
  domain: string;
  id?: string;
  fullyQualifiedName?: string;
  owners?: UserTeamRef[];
  experts?: UserTeamRef[];
};

export class DataProduct extends EntityClass {
  id = uuid();
  data: ResponseDataType = {
    name: `PW%dataProduct.${this.id}`,
    displayName: `PW Data Product ${this.id}`,
    description: 'playwright data product description',
    domain: 'PW%domain.1',
    // eslint-disable-next-line no-useless-escape
    fullyQualifiedName: `\"PW%dataProduct.${this.id}\"`,
  };

  responseData: ResponseDataType = {} as ResponseDataType;

  constructor(domain: Domain, name?: string, subDomain?: SubDomain) {
    super(EntityTypeEndpoint.DATA_PRODUCT);
    this.data.domain =
      subDomain?.data.fullyQualifiedName ||
      domain.data.fullyQualifiedName ||
      ''; // fqn
    this.data.name = name ?? this.data.name;
    // eslint-disable-next-line no-useless-escape
    this.data.fullyQualifiedName = `\"${this.data.name}\"`;
  }

  async create(apiContext: APIRequestContext) {
    const response = await apiContext.post('/api/v1/dataProducts', {
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
      `/api/v1/dataProducts/name/${encodeURIComponent(
        this.responseData?.fullyQualifiedName ?? this.data.name
      )}`
    );

    return response.body;
  }
}
