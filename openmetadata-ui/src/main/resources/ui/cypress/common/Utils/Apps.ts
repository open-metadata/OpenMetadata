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
export const checkAndDeleteApp = ({
  token,
  applicationName,
}: {
  token: string;
  applicationName: string;
}) => {
  cy.request({
    method: 'GET',
    url: '/api/v1/apps?limit=20&include=non-deleted',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).then((response) => {
    expect(response.status).to.eq(200);

    const app = response.body.data.find((app) => app.name === applicationName);

    if (app?.name === applicationName) {
      cy.request({
        method: 'DELETE',
        url: `/api/v1/apps/name/${applicationName}?hardDelete=true`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
  });
};
