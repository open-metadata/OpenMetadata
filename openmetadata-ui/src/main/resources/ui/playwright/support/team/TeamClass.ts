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
import { GlobalSettingOptions } from '../../constant/settings';
import { uuid } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';
import { searchTeam } from '../../utils/team';
type ResponseDataType = {
  name: string;
  displayName: string;
  description: string;
  teamType: string;
  id?: string;
  fullyQualifiedName?: string;
  users?: string[];
  defaultRoles?: string[];
  policies?: string[];
};

export class TeamClass {
  id = uuid();
  data: ResponseDataType;
  responseData: ResponseDataType = {} as ResponseDataType;

  constructor(data?: ResponseDataType) {
    this.data = data ?? {
      name: `PW%team-${this.id}`,
      displayName: `PW Team ${this.id}`,
      description: 'playwright team description',
      teamType: 'Group',
      users: [],
      policies: [],
    };
  }

  setTeamType(teamType: string) {
    this.data.teamType = teamType;
  }

  get() {
    return this.responseData;
  }

  async visitTeamPage(page: Page) {
    // complete url since we are making basic and advance call to get the details of the team
    const fetchOrganizationResponse = page.waitForResponse(
      `/api/v1/teams/name/Organization?fields=users%2CdefaultRoles%2Cpolicies%2CchildrenCount%2Cdomains&include=all`
    );
    await settingClick(page, GlobalSettingOptions.TEAMS);
    await fetchOrganizationResponse;

    await searchTeam(page, this.responseData?.['displayName']);

    await page
      .locator(`[data-row-key="${this.data.name}"]`)
      .getByRole('link')
      .click();

    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('team-heading')).toHaveText(
      this.data.displayName
    );
  }

  async create(apiContext: APIRequestContext) {
    const response = await apiContext.post('/api/v1/teams', {
      data: this.data,
    });
    const data = await response.json();
    this.responseData = data;

    return data;
  }

  async delete(apiContext: APIRequestContext) {
    const response = await apiContext.delete(
      `/api/v1/teams/${this.responseData.id}?hardDelete=true&recursive=false`
    );

    return await response.json();
  }

  async patch(apiContext: APIRequestContext, data: Record<string, unknown>[]) {
    const response = await apiContext.patch(
      `/api/v1/teams/${this.responseData.id}`,
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
}
