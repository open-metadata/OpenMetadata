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
import {
  DATA_CONSUMER_RULES,
  DATA_STEWARD_RULES,
} from '../../constant/permission';
import { generateRandomUsername, uuid } from '../../utils/common';
import { PolicyClass, PolicyRulesType } from '../access-control/PoliciesClass';
import { RolesClass } from '../access-control/RolesClass';
import { UserResponseDataType } from '../entity/Entity.interface';
import { TeamClass } from '../team/TeamClass';

type UserData = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
};

const dataStewardPolicy = new PolicyClass();
const dataStewardRoles = new RolesClass();
let dataStewardTeam: TeamClass;

export class UserClass {
  data: UserData;

  responseData: UserResponseDataType = {} as UserResponseDataType;
  isUserDataSteward = false;

  constructor(data?: UserData) {
    this.data = data ? data : generateRandomUsername();
  }

  async create(apiContext: APIRequestContext, assignRole = true) {
    const dataConsumerRoleResponse = await apiContext.get(
      '/api/v1/roles/name/DataConsumer'
    );

    const dataConsumerRole = await dataConsumerRoleResponse.json();

    const response = await apiContext.post('/api/v1/users/signup', {
      data: this.data,
    });

    this.responseData = await response.json();
    if (assignRole) {
      const { entity } = await this.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: {
              id: dataConsumerRole.id,
              type: 'role',
              name: dataConsumerRole.name,
            },
          },
        ],
      });

      return entity;
    }

    return this.responseData;
  }

  async patch({
    apiContext,
    patchData,
  }: {
    apiContext: APIRequestContext;
    patchData: Operation[];
  }) {
    const response = await apiContext.patch(
      `/api/v1/users/${this.responseData.id}`,
      {
        data: patchData,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    this.responseData = await response.json();

    return {
      entity: response.body,
    };
  }

  async setAdminRole(apiContext: APIRequestContext) {
    return this.patch({
      apiContext,
      patchData: [
        {
          op: 'replace',
          path: '/isAdmin',
          value: true,
        },
      ],
    });
  }

  async setCustomRulePolicy(
    apiContext: APIRequestContext,
    rules: PolicyRulesType[],
    prefix: string
  ) {
    const id = uuid();
    const policy = new PolicyClass();
    const role = new RolesClass();

    await policy.create(apiContext, rules);
    await role.create(apiContext, [policy.responseData.name]);
    const team = new TeamClass({
      name: `${prefix}-${id}`,
      displayName: `${prefix} Team ${id}`,
      description: `${prefix} team description`,
      teamType: 'Group',
      users: [this.responseData.id],
      defaultRoles: role.responseData.id ? [role.responseData.id] : [],
      policies: policy.responseData.id ? [policy.responseData.id] : [],
    });
    await team.create(apiContext);
  }

  async setDataConsumerRole(apiContext: APIRequestContext) {
    const id = uuid();
    const dataConsumerPolicy = new PolicyClass();
    const dataConsumerRoles = new RolesClass();

    await dataConsumerPolicy.create(apiContext, DATA_CONSUMER_RULES);
    await dataConsumerRoles.create(apiContext, [
      dataConsumerPolicy.responseData.name,
    ]);
    const dataConsumerTeam = new TeamClass({
      name: `PW%data_consumer_team-${id}`,
      displayName: `PW Data Consumer Team ${id}`,
      description: 'playwright data consumer team description',
      teamType: 'Group',
      users: [this.responseData.id],
      defaultRoles: dataConsumerRoles.responseData.id
        ? [dataConsumerRoles.responseData.id]
        : [],
    });
    await dataConsumerTeam.create(apiContext);
  }

  async setDataStewardRole(apiContext: APIRequestContext) {
    this.isUserDataSteward = true;
    const id = uuid();
    await dataStewardPolicy.create(apiContext, DATA_STEWARD_RULES);
    await dataStewardRoles.create(apiContext, [
      dataStewardPolicy.responseData.name,
    ]);
    dataStewardTeam = new TeamClass({
      name: `PW%data_steward_team-${id}`,
      displayName: `PW Data Steward Team ${id}`,
      description: 'playwright data steward team description',
      teamType: 'Group',
      users: [this.responseData.id],
      defaultRoles: dataStewardRoles.responseData.id
        ? [dataStewardRoles.responseData.id]
        : [],
    });
    await dataStewardTeam.create(apiContext);
  }

  async delete(apiContext: APIRequestContext, hardDelete = true) {
    if (this.isUserDataSteward) {
      await dataStewardPolicy.delete(apiContext);
      await dataStewardRoles.delete(apiContext);
      await dataStewardTeam.delete(apiContext);
    }

    const response = await apiContext.delete(
      `/api/v1/users/${this.responseData.id}?recursive=false&hardDelete=${hardDelete}`
    );

    return response.body;
  }

  getUserName() {
    return `${this.data.firstName}${this.data.lastName}`;
  }

  async login(
    page: Page,
    userName = this.data.email,
    password = this.data.password
  ) {
    await page.goto('/');
    await page.fill('input[id="email"]', userName);
    await page.locator('#email').press('Tab');
    await page.fill('input[id="password"]', password);
    const loginRes = page.waitForResponse('/api/v1/users/login');
    await page.getByTestId('login').click();
    await loginRes;

    const modal = await page
      .getByRole('dialog')
      .locator('div')
      .filter({ hasText: 'Getting Started' })
      .nth(1)
      .isVisible();

    if (modal) {
      await page.getByRole('dialog').getByRole('img').first().click();
    }
  }

  async logout(page: Page) {
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await page.getByTestId('confirm-logout').click();
  }
}
