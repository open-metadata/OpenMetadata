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
import { uuid } from '../common';

type RoleType = {
  name: string;
  policies: string[];
  id?: string;
};
type OrganizationTeamType = {
  id: string;
  policies: {
    id: string;
    type: string;
  }[];
  defaultRoles: {
    id: string;
    type: string;
  }[];
};

export const DATA_CONSUMER_POLICY = {
  name: `cy-data-consumer-policy-${uuid()}`,
  rules: [
    {
      name: `cy-data-consumer-rule-${uuid()}`,
      resources: ['All'],
      operations: ['EditDescription', 'EditTags', 'ViewAll'],
      effect: 'allow',
    },
  ],
};

export const DATA_STEWARD_POLICY = {
  name: `cy-data-steward-policy-${uuid()}`,
  rules: [
    {
      name: `cy-data-steward-rule-${uuid()}`,
      resources: ['All'],
      operations: [
        'EditDescription',
        'EditDisplayName',
        'EditLineage',
        'EditOwner',
        'EditTags',
        'ViewAll',
      ],
      effect: 'allow',
    },
  ],
};

const policyId: string[] = [];

export const DATA_CONSUMER_ROLE: RoleType = {
  name: `cy-data-consumer-role-${uuid()}`,
  policies: [DATA_CONSUMER_POLICY.name],
};
export const DATA_STEWARD_ROLE: RoleType = {
  name: `cy-data-steward-role-${uuid()}`,
  policies: [DATA_STEWARD_POLICY.name],
};
export let organizationTeam = {} as OrganizationTeamType;

export const createRoleViaREST = ({ token }) => {
  cy.request({
    method: 'POST',
    url: `/api/v1/policies`,
    headers: { Authorization: `Bearer ${token}` },
    body: DATA_CONSUMER_POLICY,
  }).then((policyResponse) => {
    policyId.push(policyResponse.body.id);
    cy.request({
      method: 'POST',
      url: `/api/v1/roles`,
      headers: { Authorization: `Bearer ${token}` },
      body: DATA_CONSUMER_ROLE,
    }).then((roleResponse) => {
      DATA_CONSUMER_ROLE.id = roleResponse.body.id;
      cy.request({
        method: 'GET',
        url: `/api/v1/teams/name/Organization?fields=defaultRoles,policies`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((orgResponse) => {
        organizationTeam = orgResponse.body;
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${orgResponse.body.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json-patch+json',
          },
          body: [
            {
              op: 'replace',
              path: '/defaultRoles',
              value: [
                {
                  id: roleResponse.body.id,
                  type: 'role',
                },
              ],
            },
          ],
        });
      });
    });
  });

  cy.request({
    method: 'POST',
    url: `/api/v1/policies`,
    headers: { Authorization: `Bearer ${token}` },
    body: DATA_STEWARD_POLICY,
  }).then((policyResponse) => {
    policyId.push(policyResponse.body.id);
    cy.request({
      method: 'POST',
      url: `/api/v1/roles`,
      headers: { Authorization: `Bearer ${token}` },
      body: DATA_STEWARD_ROLE,
    }).then((roleResponse) => {
      DATA_STEWARD_ROLE.id = roleResponse.body.id;
    });
  });
};

export const cleanupPolicies = ({ token }) => {
  [DATA_CONSUMER_ROLE, DATA_STEWARD_ROLE].forEach((role) => {
    cy.request({
      method: 'DELETE',
      url: `/api/v1/roles/${role.id}?hardDelete=true&recursive=false`,
      headers: { Authorization: `Bearer ${token}` },
    });
  });
  policyId.forEach((id) => {
    cy.request({
      method: 'DELETE',
      url: `/api/v1/policies/${id}?hardDelete=true&recursive=false`,
      headers: { Authorization: `Bearer ${token}` },
    });
  });
  cy.request({
    method: 'PATCH',
    url: `/api/v1/teams/${organizationTeam.id}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json-patch+json',
    },
    body: [
      {
        op: 'add',
        path: '/defaultRoles',
        value: organizationTeam.defaultRoles,
      },
    ],
  });
};
